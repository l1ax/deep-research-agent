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
    }),
    currentResearchTask: Annotation<string>({
        default: () => '',
        reducer: (currentResearchTask: string, newCurrentResearchTask: string) => newCurrentResearchTask
    }),
    researchFindings: Annotation<GlobalState.ResearchFindings>({
        default: () => ({
            findings: '',
            sources: [],
            task: ''
        }),
        reducer: (researchFindings: GlobalState.ResearchFindings, newResearchFindings: GlobalState.ResearchFindings) => newResearchFindings
    }),
    researchPlan: Annotation<GlobalState.ResearchPlan>({
        default: () => ({
            planText: '',
            steps: [],
            currentStepIndex: 0
        }),
        reducer: (researchPlan: GlobalState.ResearchPlan, newResearchPlan: GlobalState.ResearchPlan) => newResearchPlan
    })
})

export namespace GlobalState {
    export type SupervisorMessages = {
        type?: string;
        value: BaseMessage[];
    }
    
    export type ResearchFindings = {
        findings: string;
        sources: string[];
        task: string;
    }
    
    export type ResearchPlan = {
        planText: string;
        steps: GlobalState.ResearchStep[];
        currentStepIndex: number;
    }
    
    export type ResearchStep = {
        title: string;
        objective: string;
        actions: string[];
        deliverables: string[];
        successCriteria: string[];
    }
}
