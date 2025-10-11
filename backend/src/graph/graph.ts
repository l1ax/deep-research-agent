import {END, START, StateGraph} from '@langchain/langgraph';
import {GlobalState} from '../state/globalState';
import {clarifyAgent, researchBriefAgent} from '../node';

const workflow = new StateGraph(GlobalState)
.addNode('clarify', clarifyAgent, {ends: ['researchBrief', END]})
.addNode('researchBrief', researchBriefAgent, {ends: [END]})
.addEdge(START, 'clarify');

const app = workflow.compile();

export { app };
export default app;