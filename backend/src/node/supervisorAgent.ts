import {GlobalState} from '../state/globalState';
import {AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage} from '@langchain/core/messages';
import {Command, END} from '@langchain/langgraph';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { llm } from '../llm';
import { runResearcher } from './researcherAgent'; // 重新引入，现在作为工具使用
import { z } from 'zod';

const supervisorAgent = async (state: typeof GlobalState.State) => {
    
    const tools = [
        new DynamicStructuredTool({
            name: 'PlanTool',
			description: '基于全局 research brief 生成或更新「分步骤、可执行」研究计划：\n- 无需输入参数（从全局读取 researchBrief）\n- 仅输出：planText 与 steps（3-7 步；含 objective/actions/deliverables/successCriteria）',
            schema: z.object({}).describe('该工具不接收输入；从全局状态读取 researchBrief 生成结构化计划'),
            func: async (_input: Record<string, never>) => {
                const researchBrief = state.researchBrief;
                const trimmedBrief = (researchBrief || '').toString().trim();
                if (!trimmedBrief) {
					return JSON.stringify({ error: '缺少研究简报内容', planText: '', steps: [] });
                }
                const wrapperLlm = llm.withStructuredOutput(z.object({
                    planText: z.string().describe('一段可读的、详细且可执行的研究计划文本'),
                    steps: z.array(z.object({
                        title: z.string().min(1).describe('步骤名称/主题'),
                        objective: z.string().min(1).describe('该步骤要达成的具体目标'),
                        actions: z.array(z.string()).min(2).max(6).describe('为实现目标的原子化可执行动作'),
                        deliverables: z.array(z.string()).min(1).describe('该步骤预期产出/文档/数据'),
                        successCriteria: z.array(z.string()).min(1).describe('用于判断该步骤是否完成/达标的标准')
					})).min(3).max(7).describe('按顺序的研究步骤')
                }));
                const response = await wrapperLlm.invoke([
                    new SystemMessage('你是一个严谨的研究计划生成器。给定研究简报，请：\n- 生成 3-7 步的研究计划，每一步需包含：objective、actions(2-6条)、deliverables、successCriteria；\n- 给出总览性的 planText；\n- 计划需可执行、可验证，避免空泛措辞，动作要具体到信息源、方法或产物。'),
                    new HumanMessage(trimmedBrief)
                ]);
                
                // 将计划保存到全局状态
                const plan = {
                    planText: response.planText,
                    steps: response.steps,
                    currentStepIndex: 0
                };
                
                // 更新全局状态中的研究计划
                state.researchPlan = plan;
                
				return JSON.stringify({ planText: response.planText, steps: response.steps, currentStepIndex: 0 });
            }
        }),
        new DynamicStructuredTool({
            name: 'ConductResearch',
            description: '从研究计划中获取下一个步骤并直接调用 researcherAgent 执行研究。无需输入参数，自动从全局计划中获取当前步骤。',
            schema: z.object({}).describe('该工具不接收输入；从全局状态读取当前研究计划步骤'),
            func: async (_input: Record<string, never>) => {
                const plan = state.researchPlan;
                if (!plan || !plan.steps || plan.steps.length === 0) {
                    return JSON.stringify({ 
                        error: '没有可用的研究计划或步骤',
                        action: 'error'
                    });
                }
                
                if (plan.currentStepIndex >= plan.steps.length) {
                    return JSON.stringify({ 
                        error: '所有研究步骤已完成',
                        action: 'all_steps_completed'
                    });
                }
                
                const currentStep = plan.steps[plan.currentStepIndex];
                
                // 构建当前步骤的研究任务
                const task = `研究步骤 ${plan.currentStepIndex + 1}: ${currentStep.title}
                
目标：${currentStep.objective}

具体行动：
${currentStep.actions.map((action, index) => `${index + 1}. ${action}`).join('\n')}

预期产出：
${currentStep.deliverables.map((deliverable, index) => `${index + 1}. ${deliverable}`).join('\n')}

成功标准：
${currentStep.successCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n')}`;
                
                // 直接调用researcherAgent
                try {
                    const researchResult = await runResearcher(task);
                    
                    // 更新研究计划中的当前步骤索引
                    const updatedPlan = {
                        ...state.researchPlan,
                        currentStepIndex: plan.currentStepIndex + 1
                    };
                    state.researchPlan = updatedPlan;
                    
                    return JSON.stringify({ 
                        action: 'research_completed',
                        task: task,
                        stepIndex: plan.currentStepIndex,
                        stepTitle: currentStep.title,
                        findings: researchResult.findings,
                        sources: researchResult.sources,
                        message: `研究步骤 ${plan.currentStepIndex + 1}/${plan.steps.length} 完成: ${currentStep.title}`
                    });
                } catch (error) {
                    return JSON.stringify({ 
                        error: `研究执行失败: ${error}`,
                        action: 'error',
                        task: task
                    });
                }
            }
        }),
		new DynamicStructuredTool({
			name: 'ThinkTool',
			description: '在每次 ConductResearch 之后调用：进行反思与决策。输入：{ observations: string }；输出：analysis、nextTask、shouldContinue。',
			schema: z.object({
				observations: z.string().describe('对最新研究结果的提炼：发现、差距、证据可靠性、冲突点')
			}),
			func: async (input: { observations: string }) => {
				// 使用LLM进行智能反思
				const thinkPrompt = [
					new SystemMessage(`你是一个研究监督专家。基于研究结果，你需要：
1. 深度分析研究结果的质量和完整性
2. 识别研究缺口和需要进一步调查的方向
3. 决定是否需要委派更多研究任务
4. 评估是否可以得出最终结论

请以JSON格式返回：
{
  "analysis": "深度分析研究结果、证据质量、信息完整性等",
  "nextTask": "如果需要继续研究，具体的下一个研究任务",
  "shouldContinue": true/false
}`),
					new HumanMessage(`研究观察：${input.observations}`)
				];
				
				const wrappedLlm = llm.withStructuredOutput(z.object({
					analysis: z.string().describe('深度分析研究结果、证据质量、信息完整性等'),
					nextTask: z.string().describe('如果需要继续研究，具体的下一个研究任务'),
					shouldContinue: z.boolean().describe('是否需要继续研究')
				}));
				
				const result = await wrappedLlm.invoke(thinkPrompt);
				return JSON.stringify(result);
			}
		}),
		new DynamicStructuredTool({
			name: 'ResearchComplete',
			description: '当研究充分时调用以结束流程。参数：{ summary }',
			schema: z.object({
				summary: z.string().min(1).describe('最终研究总结，包含结论、证据要点与建议')
			}),
			func: async (input: { summary: string }) => {
				return JSON.stringify({ summary: input.summary });
			}
		})
    ];

    const model = llm.bindTools(tools);

    const history: BaseMessage[] = state.supervisorMessages.value;
    let finalSummary: string | null = null;
    let iterations = 0;
    const MAX_ITER = 8; // 与系统提示的大致一致，略高一些做保险

    while (iterations < MAX_ITER) {
        const ai = await model.invoke(history);
        history.push(ai);

        // 若没有工具调用，则视为模型已直接给出答案
        const toolCalls = ai.tool_calls ?? [];
        if (!toolCalls.length) {
            finalSummary = (ai.content as string) || '';
            break;
        }

        for (const call of toolCalls) {
            const toolName = call.name || '';
            const tool = tools.find(t => t.name === toolName);
            if (!tool) continue;
            const result = await (tool as any).func(call.args ?? {});
            
            // 工具结果回传给模型
            history.push(new ToolMessage({
                content: result,
                tool_call_id: call.id || ''
            }));

            if (toolName === 'ResearchComplete') {
                try {
                    const parsed = JSON.parse(typeof result === 'string' ? result : '');
                    finalSummary = parsed?.summary || (typeof result === 'string' ? result : '');
                } catch {
                    finalSummary = typeof result === 'string' ? result : '';
                }
            }
        }

        if (finalSummary) break;
        iterations += 1;
    }

    const outputMessage = new AIMessage(finalSummary ?? '研究流程已结束。');

    return new Command({
        goto: END,
        update: {
            supervisorMessages: {
                value: history
            },
            messages: [outputMessage]
        }
    });
}

export default supervisorAgent;