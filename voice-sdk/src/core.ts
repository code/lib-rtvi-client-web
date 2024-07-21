import { deepmerge } from "deepmerge-ts";
import { EventEmitter } from "events";
import type TypedEmitter from "typed-emitter";

import {
  VoiceClientConfigLLM,
  VoiceClientConfigOptions,
  VoiceClientOptions,
  VoiceMessage,
  VoiceMessageTranscript,
} from ".";
import * as VoiceErrors from "./errors";
import { VoiceEvent, VoiceEvents } from "./events";
import {
  DailyTransport,
  Participant,
  Transport,
  TransportState,
} from "./transport";

export type VoiceEventCallbacks = Partial<{
  onConnected: () => void;
  onDisconnected: () => void;
  onTransportStateChanged: (state: TransportState) => void;

  onConfigUpdated: (config: VoiceClientConfigOptions) => void;

  onBotConnected: (participant: Participant) => void;
  onBotDisconnected: (participant: Participant) => void;

  onParticipantJoined: (participant: Participant) => void;
  onParticipantLeft: (participant: Participant) => void;

  onTrackStarted: (track: MediaStreamTrack, participant?: Participant) => void;
  onTrackStopped: (track: MediaStreamTrack, participant?: Participant) => void;

  onLocalAudioLevel: (level: number) => void;
  onRemoteAudioLevel: (level: number, participant: Participant) => void;

  onBotStartedTalking: (participant: Participant) => void;
  onBotStoppedTalking: (participant: Participant) => void;
  onLocalStartedTalking: () => void;
  onLocalStoppedTalking: () => void;

  onTranscript: (text: VoiceMessageTranscript) => void;

  onJsonCompletion: (jsonString: string) => any;

  // @@ Not yet implemented @@
  // onTextFrame: (text: string) => void;
}>;

export abstract class Client extends (EventEmitter as new () => TypedEmitter<VoiceEvents>) {
  protected _options: VoiceClientOptions;
  private _transport: Transport;
  private readonly _baseUrl: string;

  constructor(options: VoiceClientOptions) {
    super();

    this._baseUrl = options.baseUrl || "https://rtvi.pipecat.bot";

    // Wrap transport callbacks with events for developer convenience
    const wrappedCallbacks: VoiceEventCallbacks = {
      ...options.callbacks,
      onConnected: () => {
        options?.callbacks?.onConnected?.();
        this.emit(VoiceEvent.Connected);
      },
      onDisconnected: () => {
        options?.callbacks?.onDisconnected?.();
        this.emit(VoiceEvent.Disconnected);
      },
      onTransportStateChanged: (state: TransportState) => {
        options?.callbacks?.onTransportStateChanged?.(state);
        this.emit(VoiceEvent.TransportStateChanged, state);
      },
      onConfigUpdated: (config: VoiceClientConfigOptions) => {
        options?.callbacks?.onConfigUpdated?.(config);
        this.emit(VoiceEvent.ConfigUpdated, config);
      },
      onParticipantJoined: (p) => {
        options?.callbacks?.onParticipantJoined?.(p);
        this.emit(VoiceEvent.ParticipantConnected, p);
      },
      onParticipantLeft: (p) => {
        options?.callbacks?.onParticipantLeft?.(p);
        this.emit(VoiceEvent.ParticipantLeft, p);
      },
      onTrackStarted: (track, p) => {
        options?.callbacks?.onTrackStarted?.(track, p);
        this.emit(VoiceEvent.TrackStarted, track, p);
      },
      onTrackStopped: (track, p) => {
        options?.callbacks?.onTrackStopped?.(track, p);
        this.emit(VoiceEvent.TrackedStopped, track, p);
      },
      onBotStartedTalking: (p) => {
        options?.callbacks?.onBotStartedTalking?.(p);
        this.emit(VoiceEvent.BotStartedTalking, p);
      },
      onBotStoppedTalking: (p) => {
        options?.callbacks?.onBotStoppedTalking?.(p);
        this.emit(VoiceEvent.BotStoppedTalking, p);
      },
      onRemoteAudioLevel: (level, p) => {
        options?.callbacks?.onRemoteAudioLevel?.(level, p);
        this.emit(VoiceEvent.RemoteAudioLevel, level, p);
      },
      onLocalStartedTalking: () => {
        options?.callbacks?.onLocalStartedTalking?.();
        this.emit(VoiceEvent.LocalStartedTalking);
      },
      onLocalStoppedTalking: () => {
        options?.callbacks?.onLocalStoppedTalking?.();
        this.emit(VoiceEvent.LocalStoppedTalking);
      },
      onLocalAudioLevel: (level) => {
        options?.callbacks?.onLocalAudioLevel?.(level);
        this.emit(VoiceEvent.LocalAudioLevel, level);
      },
      onJsonCompletion: (jsonString: string) => {
        options?.callbacks?.onJsonCompletion?.(jsonString);
        this.emit(VoiceEvent.JSONCompletion, jsonString);
      },
    };

    // Instantiate the transport
    this._transport = options?.config?.transport
      ? new options.config.transport(
          {
            ...options,
            callbacks: wrappedCallbacks,
          },
          this.handleMessage
        )!
      : new DailyTransport(
          {
            ...options,
            callbacks: wrappedCallbacks,
          },
          this.handleMessage
        );

    this._options = {
      ...options,
      callbacks: wrappedCallbacks,
    };
  }

  // ------ Transport methods
  public async start() {
    this._transport.state = "handshaking";

    const config: VoiceClientConfigOptions = this._options.config!;

    /**
     * SOF: placeholder service-side logic
     */
    // Handshake with the server to get the room and token
    // Note: this should be done on the server side
    const { room, token } = await fetch(`${this._baseUrl}/authenticate`, {
      method: "POST",
      mode: "cors",
    }).then((res) => res.json());

    if (!room || !token) {
      // In lieu of proper error codes, a failed authentication indicates
      // the server is busy.
      throw new VoiceErrors.RateLimitError();
    }
    /**
     * EOF: placeholder service-side logic
     */

    try {
      await fetch(`${this._baseUrl}/start_bot`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room, config: { ...config } }),
      });
    } catch {
      throw new VoiceErrors.BotStartError(`Failed to start bot at URL ${room}`);
    }

    await this._transport.connect({
      url: room,
      token,
    });
  }

  public async disconnect() {
    await this._transport.disconnect();
  }

  public enableMic(enable: boolean) {
    this._transport.enableMic(enable);
  }

  public get isMicEnabled(): boolean {
    return this._transport.isMicEnabled;
  }

  public get state(): TransportState {
    return this._transport.state;
  }

  // ------ Config methods

  public get config(): VoiceClientConfigOptions {
    return this._options.config!;
  }

  protected set config(config: VoiceClientConfigOptions) {
    this._options.config = {
      ...this._options.config,
      ...config,
    };
  }

  public updateConfig(
    config: VoiceClientConfigOptions,
    useDeepMerge: boolean = false,
    sendPartial: boolean = false
  ) {
    if (useDeepMerge) {
      this.config = deepmerge(this.config, config);
    } else {
      this.config = config;
    }

    if (this._transport.state === "connected") {
      this._transport.sendMessage(
        VoiceMessage.config(sendPartial ? config : this.config)
      );
    }

    this._options.callbacks?.onConfigUpdated?.(this.config);
  }

  // ------ LLM context methods

  public get llmContext(): VoiceClientConfigLLM | undefined {
    return this._options.config?.llm;
  }

  public set llmContext(llmConfig: VoiceClientConfigLLM) {
    this.config = {
      ...this._options.config,
      llm: {
        ...this._options.config?.llm,
        ...llmConfig,
      },
    } as VoiceClientConfigOptions;

    if (this._transport.state === "connected") {
      this._transport.sendMessage(VoiceMessage.updateLLMContext(llmConfig));
    }

    this._options.callbacks?.onConfigUpdated?.(this.config);
  }

  /**
   * Append a message to the live LLM context. Requires the bot to be connected.
   * @param message - LLM message (role and content)
   */
  public appendLLMContext(message: { role: string; content: string }): void {
    if (this._transport.state === "connected") {
      this._transport.sendMessage(VoiceMessage.appendLLMContext(message));
    } else {
      throw new VoiceErrors.VoiceError(
        "Attempt to update LLM context while transport not in connected state"
      );
    }
  }

  // ------ Utility methods

  /**
   * Send a string to the STT model to be spoken. Requires the bot to be connected.
   * @param text - The text to be spoken
   * @param interrupt - Whether to interrupt the current speech (if the bot is talking)
   */
  public say(text: string, interrupt: boolean = false): void {
    if (this._transport.state === "connected") {
      this._transport.sendMessage(VoiceMessage.speak(text, interrupt));
    } else {
      throw new VoiceErrors.VoiceError(
        "Attempted to speak while transport not in connected state"
      );
    }
  }

  /**
   * Manually interrupt the bot's TTS. Requires the bot to be connected.
   */
  public interrupt(): void {
    if (this._transport.state === "connected") {
      this._transport.sendMessage(VoiceMessage.interrupt());
    } else {
      throw new VoiceErrors.VoiceError(
        "Attempted to interrupt bot TTS wite transport not in connected state"
      );
    }
  }

  // ------ Handlers
  protected handleMessage(ev: VoiceMessage): void {
    if (ev instanceof VoiceMessageTranscript) {
      return this._options.callbacks?.onTranscript?.(ev);
    }
  }

  protected handleConfigUpdate(config: VoiceClientConfigOptions) {
    // Send app message on the transport
    // If successfull, the transport will trigger the onConfigUpdate callback
    this._transport.sendMessage(VoiceMessage.config(config));
  }

  public tracks() {
    return this._transport.tracks();
  }
}
