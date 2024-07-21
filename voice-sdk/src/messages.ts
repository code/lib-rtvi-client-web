import { VoiceClientConfigLLM, VoiceClientConfigOptions } from ".";

enum VoiceMessageType {
  // Outbound
  CONFIG = "config-update",
  LLM_GET_CONTEXT = "llm-get-context",
  LLM_UPDATE_CONTEXT = "llm-update-context",
  LLM_APPEND_CONTEXT = "llm-append-context",
  SPEAK = "tts-speak",
  INTERRUPT = "tts-interrupt",

  // Inbound
  LLM_CONTEXT = "llm-context", // LLM context message
  TRANSCRIPT = "transcript", // STT transcript (both local and remote) flagged with partial, final or sentence
  CONFIG_UPDATED = "config-updated", // Configuration options have changed successfull
  CONFIG_ERROR = "config-error", // Configuration options have changed failed
  TOOL_CALL = "tool-call", // Instruction to call a clientside tool method (expects a serialized method name and params)
  JSON_COMPLETION = "json-completion",
  // Inbound (optional / not yet implemented)
  //INTERRUPT = "interrupt", // Local user interrupted the conversation
  //TOOL_RESPONSE = "tool-response", // Result of a clientside tool method
}

export class VoiceMessage {
  tag: string = "realtime-ai";
  type: string;
  data: unknown;

  constructor(type: string, data: unknown) {
    this.type = type;
    this.data = data;
  }

  public serialize(): string {
    return JSON.stringify({
      type: this.type,
      tag: this.tag,
      data: this.data,
    });
  }

  // Outbound message types
  static config(configuration: VoiceClientConfigOptions): VoiceMessage {
    // Sent when the configuration options of services has changed
    // We only send a partial configuration update to the bot related to the pipeline
    return new VoiceMessage(VoiceMessageType.CONFIG, {
      config: {
        llm: configuration.llm,
        tts: configuration.tts,
      },
    });
  }

  // TTS
  static speak(message: string, interrupt: boolean): VoiceMessage {
    // Sent when prompting the STT model to speak
    return new VoiceMessage(VoiceMessageType.SPEAK, {
      tts: { text: message, interrupt },
    });
  }

  static interrupt(): VoiceMessage {
    return new VoiceMessage(VoiceMessageType.INTERRUPT, {});
  }

  // LLM
  static getLLMContext(): VoiceMessage {
    // Sent when requesting the latest LLM context
    return new VoiceMessage(VoiceMessageType.LLM_GET_CONTEXT, {});
  }

  static updateLLMContext(llmConfig: VoiceClientConfigLLM): VoiceMessage {
    return new VoiceMessage(VoiceMessageType.LLM_UPDATE_CONTEXT, {
      llm: llmConfig,
    });
  }

  static appendLLMContext(message: {
    role: string;
    content: string;
  }): VoiceMessage {
    return new VoiceMessage(VoiceMessageType.LLM_APPEND_CONTEXT, {
      llm: { messages: [message] },
    });
  }
}

export class VoiceMessageTranscript extends VoiceMessage {
  constructor(data: { text: string; final: boolean }) {
    super(VoiceMessageType.TRANSCRIPT, data);
  }
}
