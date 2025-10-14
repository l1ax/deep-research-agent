import {END, START, StateGraph} from '@langchain/langgraph';
import {GlobalState} from '../state/globalState';
import {clarifyAgent, researchBriefAgent, supervisorAgent} from '../node';

const workflow = new StateGraph(GlobalState)
.addNode('clarifyAgent', clarifyAgent, {ends: ['researchBriefAgent', END]})
.addNode('researchBriefAgent', researchBriefAgent, {ends: ['supervisorAgent']})
.addNode('supervisorAgent', supervisorAgent, {ends: [END]})
.addEdge(START, 'clarifyAgent');

const app = workflow.compile();

export { app };
export default app;