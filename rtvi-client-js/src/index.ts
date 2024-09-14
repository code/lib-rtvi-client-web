import { Client, VoiceEventCallbacks } from "./core";
import { VoiceMessage } from "./messages";
import { Transport } from "./transport";

export interface VoiceClientOptions {
  /**
   * Base URL for auth handlers and transport services
   *
   * Defaults to a POST request with a the config object as the body
   */
  baseUrl: string;

  /**
   * Set transport class for media streaming
   */
  transport?: new (
    options: VoiceClientOptions,
    onMessage: (ev: VoiceMessage) => void
  ) => Transport;

  /**
   * Parameters passed as JSON stringified body params to the baseUrl
   */
  startParams?: Partial<{
    config?: VoiceClientConfigOption[];
  }>;

  /**
   * HTTP headers to be send with the POST request to baseUrl
   */
  startHeaders?: { [key: string]: string };

  /**
   * Optional callback methods for voice events
   */
  callbacks?: VoiceEventCallbacks;

  /**
   * Handshake timeout
   *
   * How long should the client wait for the bot ready event (when authenticating / requesting an agent)
   * Defaults to no timeout (undefined)
   */
  timeout?: number;

  /**
   * Enable user mic input
   *
   * Default to true
   */
  enableMic?: boolean;

  /**
   * Enable user cam input
   *
   * Default to false
   */
  enableCam?: boolean;

  /**
   * Custom start method handler for retrieving auth bundle for transport
   * @param baseUrl
   * @param startParams
   * @param timeout
   * @param abortController
   * @returns Promise<void>
   */
  customAuthHandler?: (
    baseUrl: string,
    startParams: object,
    timeout: ReturnType<typeof setTimeout> | undefined,
    abortController: AbortController
  ) => Promise<void>;

  // ----- deprecated options

  /**
   * Service key value pairs (e.g. {llm: "openai"} )
   * A client must have at least one service to connect to a voice server
   * @deprecated Use startParams.services instead
   */
  services?: VoiceClientServices;

  /**
   * Service configuration options for services and further customization
   * @deprecated Use startParams.config instead
   */
  config?: VoiceClientConfigOption[];

  /**
   * Custom HTTP headers to be send with the POST request to baseUrl
   * @deprecated Use startHeaders instead
   */
  customHeaders?: { [key: string]: string };

  /**
   * Custom request parameters to send with the POST request to baseUrl
   * @deprecated Use startParams instead
   */
  customBodyParams?: object;
}

export type ConfigOption = {
  name: string;
  value: unknown;
};

export type VoiceClientConfigOption = {
  service: string;
  options: ConfigOption[];
};

export type VoiceClientServices = { [key: string]: string };

/**
 * RTVI Voice Client
 */
export class VoiceClient extends Client {
  constructor({ ...opts }: VoiceClientOptions) {
    const options: VoiceClientOptions = {
      ...opts,
      transport: opts.transport,
      enableMic: opts.enableMic ?? true,
    };

    super(options);
  }
}

/**
 * RTVI Text Client
 */
// ...

export * from "./core";
export * from "./errors";
export * from "./events";
export * from "./helpers";
export * from "./helpers/llm";
export * from "./messages";
export * from "./transport";
