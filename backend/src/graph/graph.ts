import {END, START, StateGraph} from '@langchain/langgraph';
import {globalState} from '../state/globalState';
import {generateQuery, reflection, webSearch} from '../nodes';

const workflow = new StateGraph(globalState)
.addNode('generateQuery', generateQuery, {ends: ['webSearch']})
.addNode('webSearch', webSearch, {ends: ['reflection']})
.addNode('reflection', reflection, {ends: [END, 'webSearch']})
.addEdge(START, 'generateQuery')

const app = workflow.compile();

export default app;
export {app};