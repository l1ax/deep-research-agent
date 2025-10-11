import {START, StateGraph} from '@langchain/langgraph';
import {GlobalState} from '../state/globalState';
import {clarifyAgent} from '../node';

const workflow = new StateGraph(GlobalState)
.addNode('clarify', clarifyAgent)
.addEdge(START, 'clarify');

const app = workflow.compile();

export default app;