import { BaseMessage } from "@langchain/core/messages";
import {Annotation, messagesStateReducer} from '@langchain/langgraph';

export const GlobalState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        default: () => [],
        reducer: messagesStateReducer
    }),
    supervisorMessages: Annotation({
        default: () => ({
            value: []
        }),
        reducer: (supervisorMessages: GlobalState.SupervisorMessages, newSupervisorMessage: GlobalState.SupervisorMessages) => {
            if (newSupervisorMessage.type === 'override') {
                return {
                    value: newSupervisorMessage.value
                };
            }

            return {
                value: [...supervisorMessages.value, ...newSupervisorMessage.value]
            };
        }
    }),
    researchBrief: Annotation<string>({
        default: () => '',
        reducer: (researchBrief: string, newResearchBrief: string) => newResearchBrief
    })
})

export namespace GlobalState {
    export type SupervisorMessages = {
        type?: string;
        value: BaseMessage[];
    }
}
