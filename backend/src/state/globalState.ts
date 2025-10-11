import { BaseMessage } from "@langchain/core/messages";
import {Annotation, messagesStateReducer} from '@langchain/langgraph';

export const GlobalState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        default: () => [],
        reducer: messagesStateReducer
    })
})
