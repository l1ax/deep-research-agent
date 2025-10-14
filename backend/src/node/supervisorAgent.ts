import {GlobalState} from '../state/globalState';
import {AIMessage, BaseMessage, ToolMessage} from '@langchain/core/messages';
import {Command, END} from '@langchain/langgraph';
import { DynamicTool } from '@langchain/core/tools';
import { llm } from '../llm';

const supervisorAgent = async (state: typeof GlobalState.State) => {
    const tools = [
        new DynamicTool({
            name: 'PlanTool',
            description: '根据研究问题生成或更新分步计划。输入应为 JSON：{ "context": string }',
            func: async (input: string) => {
                let context = input;
                try { const parsed = JSON.parse(input); if (parsed && parsed.context) context = parsed.context; } catch {}
                const trimmed = (context || '').toString().trim();
                const steps = [
                    `细化研究问题与范围：${trimmed}`,
                    '收集权威来源与近一年资料',
                    '总结关键发现并给出可执行建议'
                ];
                const planText = `计划:\n1) ${steps[0]}\n2) ${steps[1]}\n3) ${steps[2]}`;
                return JSON.stringify({ planText, steps });
            }
        }),
        new DynamicTool({
            name: 'ConductResearch',
            description: '针对具体任务进行研究。输入应为 JSON：{ "task": string }',
            func: async (input: string) => {
                let task = input;
                try { const parsed = JSON.parse(input); if (parsed && parsed.task) task = parsed.task; } catch {}
                const findings = `针对任务「${task}」的要点：\n- 汇总基础背景、近期进展与主流观点\n- 标注3类参考来源（学术/新闻/博客）\n- 识别常见误区与不确定性`;
                return JSON.stringify({ findings });
            }
        }),
        new DynamicTool({
            name: 'ThinkTool',
            description: '在每次 ConductResearch 之后进行反思。输入应为 JSON：{ "observations": string }',
            func: async (_input: string) => {
                const analysis = '思考：当前证据足以形成答案框架，继续深挖收益可能递减；建议产出初版总结，如需更高把握度再指定子问题迭代。';
                const shouldContinue = false;
                return JSON.stringify({ analysis, shouldContinue });
            }
        }),
        new DynamicTool({
            name: 'ResearchComplete',
            description: '当研究充分时调用以结束流程。输入应为 JSON：{ "summary": string }',
            func: async (input: string) => {
                try { JSON.parse(input); } catch { /* 放行非 JSON 文本 */ }
                return input || '{"summary":"done"}';
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
            const args = call.args ? JSON.stringify(call.args) : '';
            const tool = tools.find(t => t.name === toolName);
            if (!tool) continue;
            const result = await tool.func(args);
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