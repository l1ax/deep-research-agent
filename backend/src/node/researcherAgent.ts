import { BaseMessage, HumanMessage, isToolMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { llm } from '../llm';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import {DynamicStructuredTool} from '@langchain/core/tools';
import { Command } from '@langchain/langgraph';
import { GlobalState } from '../state/globalState';
import dotenv from 'dotenv';

dotenv.config();

// 保留用于未来结构化输出
// const ResearcherOutput = z.object({
//     findings: z.string().describe('结构化的研究发现与要点，包含证据引用位置/链接占位'),
//     sources: z.array(z.string()).default([]).describe('参考来源列表（URL、标题或标识）')
// });

const tools = [
    new DynamicStructuredTool({
        name: 'SearchTool',
        description: 'Search the web for information',
        schema: z.object({
            query: z.string().describe('The query to search the web for')
        }),
        func: async (input: { query: string }) => {
            const response = await fetch('https://qianfan.baidubce.com/v2/ai_search/web_search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + process.env.AB_API_KEY
                },
                body: JSON.stringify({
                    "messages": [
                        {
                            role: 'user',
                            content: input.query
                        }
                    ],
                    "edition": "standard",
                    "search_source": "baidu_search_v2",
                    "search_recency_filter": "week"
                })
            });
            const data = await response.json();
            return data.references?.map((reference: any) => reference.content).join('\n\n') || 'No search results found.';
        }
    }),
    new DynamicStructuredTool({
        name: 'ThinkTool',
        description: '进行策略性反思，评估当前研究进展和下一步行动。输入：{ observations: string }；输出：analysis、nextAction、shouldContinue。',
        schema: z.object({
            observations: z.string().describe('对当前研究结果的观察：发现、证据质量、信息缺口、需要验证的假设')
        }),
        func: async (input: { observations: string }) => {
            // 使用LLM进行智能反思
            const thinkPrompt = [
                new SystemMessage(`你是一个研究策略分析师。基于当前的研究观察，你需要：
1. 深度分析当前研究进展的质量和完整性
2. 识别信息缺口和需要验证的假设
3. 决定下一步具体的研究行动
4. 判断是否需要继续研究

请以JSON格式返回：
{
  "analysis": "深度分析当前研究状态、证据质量、信息完整性等",
  "nextAction": "具体的下一步行动建议，如搜索什么、验证什么假设等",
  "shouldContinue": true/false
}`),
                new HumanMessage(`研究观察：${input.observations}`)
            ];
            
            const wrappedLlm = llm.withStructuredOutput(z.object({
                analysis: z.string().describe('深度分析当前研究状态、证据质量、信息完整性等'),
                nextAction: z.string().describe('具体的下一步行动建议'),
                shouldContinue: z.boolean().describe('是否需要继续研究')
            }));
            
            const result = await wrappedLlm.invoke(thinkPrompt);
            return JSON.stringify(result);
        }
    }),
    new DynamicStructuredTool({
        name: 'ResearchComplete',
        description: '当当前研究任务完成时调用，提供研究总结。参数：{ summary: string }',
        schema: z.object({
            summary: z.string().min(1).describe('当前研究任务的完整总结，包含关键发现、证据要点和结论')
        }),
        func: async (input: { summary: string }) => {
            // 使用LLM进行智能总结和验证
            const completePrompt = [
                new SystemMessage(`你是一个研究总结专家。基于提供的研究总结，你需要：
1. 验证总结的完整性和准确性
2. 确保关键发现都有足够的证据支持
3. 检查是否有遗漏的重要信息
4. 优化总结的结构和可读性

请返回优化后的最终研究总结。`),
                new HumanMessage(`研究总结：${input.summary}`)
            ];
            
            const wrappedLlm = llm.withStructuredOutput(z.object({
                finalSummary: z.string().describe('优化后的最终研究总结'),
                confidence: z.number().min(0).max(1).describe('对研究完整性的信心度(0-1)'),
                keyFindings: z.array(z.string()).describe('关键发现列表'),
                evidenceQuality: z.string().describe('证据质量评估')
            }));
            
            const result = await wrappedLlm.invoke(completePrompt);
            return JSON.stringify({
                summary: result.finalSummary,
                confidence: result.confidence,
                keyFindings: result.keyFindings,
                evidenceQuality: result.evidenceQuality
            });
        }
    })
]

// 创建带有完整工具的 researcher agent
const researcher = createReactAgent({
    llm,
    tools: tools
});

// researcherAgent作为独立的LangGraph节点
export const researcherAgent = async (state: typeof GlobalState.State) => {
    // 从状态中获取研究任务
    const task = state.currentResearchTask || '未指定研究任务';
    
    const prompt: BaseMessage[] = [
        new SystemMessage(
            `你是一个专注的领域研究专家。你的任务是调查给定的任务并返回简洁、结构化的发现和来源引用。
            
            智能研究流程：
            1. 使用SearchTool搜索相关信息，获取初始数据
            2. 使用ThinkTool进行策略性反思：
               - 分析已获得信息的质量和完整性
               - 识别信息缺口和需要验证的假设
               - 决定下一步具体的研究行动
               - 判断是否需要继续深入研究
            3. 根据ThinkTool的建议进行更多搜索或验证
            4. 重复步骤2-3，直到ThinkTool建议研究充分
            5. 使用ResearchComplete提供最终研究总结：
               - 确保总结的完整性和准确性
               - 优化结构和可读性
               - 提供信心度评估
            
            研究质量要求：
            - 避免泛泛而谈，提供具体、可验证的信息
            - 确保每个发现都有可靠的来源支持
            - 结构化组织信息，便于理解和引用
            - 进行多轮搜索和反思，确保研究深度
            - 在ThinkTool确认研究充分后再调用ResearchComplete工具
            - **搜索策略优化：每次搜索时使用精确、具体的关键词，确保搜索结果信息密度高、相关性强**
            
            特别注意：
            - 每次搜索后都要调用ThinkTool进行评估
            - 根据ThinkTool的shouldContinue参数决定是否继续
            - 只有ThinkTool确认研究充分时才调用ResearchComplete
            - **重要限制：最多只能调用3次SearchTool，之后必须调用ResearchComplete完成研究**`
        ),
        new HumanMessage(`研究任务：${task}`)
    ];
    
    const model = llm.bindTools(tools);
    const history: BaseMessage[] = [...prompt];
    let finalSummary: string | null = null;
    let iterations = 0;
    let searchToolCallCount = 0;
    const MAX_ITER = 10; // 限制最大迭代次数
    const MAX_SEARCH_CALLS = 3; // 限制最多3轮SearchTool调用

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
            
            // 检查SearchTool调用次数限制
            if (toolName === 'SearchTool') {
                searchToolCallCount++;
                if (searchToolCallCount > MAX_SEARCH_CALLS) {
                    // 超过最大搜索次数，强制完成研究
                    history.push(new ToolMessage({
                        content: `已达到最大搜索次数限制(${MAX_SEARCH_CALLS}次)，请立即调用ResearchComplete工具完成研究总结。`,
                        tool_call_id: call.id || ''
                    }));
                    continue;
                }
            }
            
            const result = await (tool as any).func(call.args ?? {});
            
            // 工具结果回传给模型
            history.push(new ToolMessage({
                content: result,
                tool_call_id: call.id || ''
            }));

            // 如果调用了ResearchComplete，准备结束
            if (toolName === 'ResearchComplete') {
                try {
                    const parsed = JSON.parse(typeof result === 'string' ? result : '');
                    finalSummary = parsed?.summary || parsed?.finalSummary || (typeof result === 'string' ? result : '');
                } catch {
                    finalSummary = typeof result === 'string' ? result : '';
                }
                break;
            }
        }

        if (finalSummary) break;
        iterations += 1;
    }

    // 提取研究发现和来源
    let findings = finalSummary || '研究未完成';
    let sources: string[] = [];
    
    for (const message of history) {
        if (isToolMessage(message)) {
            const toolMessage = message as any;
            if (toolMessage.name === 'SearchTool' && toolMessage.content) {
                sources.push(toolMessage.content);
            }
        }
    }

    // 返回到supervisorAgent
    return new Command({
        goto: 'supervisorAgent',
        update: {
            messages: [...state.messages, new HumanMessage(`研究结果：${findings}`)],
            researchFindings: {
                findings,
                sources,
                task
            }
        }
    });
}

// 保留原有的runResearcher函数用于向后兼容
export const runResearcher = async (task: string) => {
    const prompt: BaseMessage[] = [
        new SystemMessage(
            `你是一个专注的领域研究专家。你的任务是调查给定的任务并返回简洁、结构化的发现和来源引用。
            
            工作流程：
            1. 使用SearchTool搜索相关信息
            2. 使用ThinkTool进行策略性反思，评估研究进展
            3. 根据需要进行更多搜索或验证
            4. 使用ResearchComplete提供最终研究总结
            
            要求：
            - 避免泛泛而谈，提供具体、可验证的信息
            - 确保每个发现都有可靠的来源支持
            - 结构化组织信息，便于理解和引用
            - 在完成研究后调用ResearchComplete工具`
        ),
        new HumanMessage(`研究任务：${task}`)
    ];
    
    // 使用ReAct agent进行工具调用
    const result = await researcher.invoke({
        messages: prompt
    });
    
    // 从最后的消息中提取研究发现和来源
    const lastMessage = result.messages[result.messages.length - 1];
    let findings = '';
    let sources: string[] = [];
    
    if (lastMessage && 'content' in lastMessage) {
        findings = lastMessage.content as string;
    }
    
    // 尝试从工具调用结果中提取来源信息
    for (const message of result.messages) {
        if (isToolMessage(message)) {
            const toolMessage = message as any;
            if (toolMessage.name === 'SearchTool' && toolMessage.content) {
                sources.push(toolMessage.content);
            }
        }
    }
    
    return { findings, sources };
}

export default researcher;


