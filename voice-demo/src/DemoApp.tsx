import { useCallback, useRef, useState } from "react";
import {
  useVoiceClient,
  useVoiceClientEvent,
  VoiceClientAudio,
} from "@realtime-ai/voice-sdk-react";
import {
  RateLimitError,
  TransportState,
  VoiceClientConfigOptions,
  VoiceEvent,
} from "@realtime-ai/voice-sdk";

export const DemoApp = () => {
  const voiceClient = useVoiceClient()!;
  const [isConnected, setIsConnected] = useState(false);
  const [isBotConnected, setIsBotConnected] = useState(false);
  const [transportState, setTransportState] = useState<TransportState>(
    voiceClient.state
  );
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<VoiceClientConfigOptions>(
    voiceClient.config
  );
  const [llmContext, setLlmContext] = useState<
    { role: string; content: string }[] | undefined
  >(voiceClient.llmContext?.messages);

  const [message, setMessage] = useState<string>("");
  const [role, setRole] = useState<string>("user");
  const [voice, setVoice] = useState<string | undefined>(
    voiceClient.config.tts?.voice
  );

  async function start() {
    try {
      await voiceClient.start();
    } catch (e) {
      if (e instanceof RateLimitError) {
        setError("Demo is currently at capacity. Please try again later.");
      }
    }
  }

  useVoiceClientEvent(
    VoiceEvent.Connected,
    useCallback(() => {
      setIsConnected(true);
    }, [])
  );

  useVoiceClientEvent(
    VoiceEvent.Disconnected,
    useCallback(() => {
      setIsConnected(false);
      setIsBotConnected(false);
    }, [])
  );
  useVoiceClientEvent(
    VoiceEvent.ParticipantConnected,
    useCallback((p) => {
      if (!p.local) setIsBotConnected(true);
    }, [])
  );

  useVoiceClientEvent(
    VoiceEvent.TransportStateChanged,
    useCallback((state: TransportState) => {
      setTransportState(state);
    }, [])
  );

  useVoiceClientEvent(
    VoiceEvent.ParticipantLeft,
    useCallback((p) => {
      if (!p.local) setIsBotConnected(false);
    }, [])
  );

  useVoiceClientEvent(
    VoiceEvent.ConfigUpdated,
    useCallback((config: VoiceClientConfigOptions) => {
      console.log(config);
      setConfig(config);
    }, [])
  );

  useVoiceClientEvent(
    VoiceEvent.JSONCompletion,
    useCallback((jsonString: string) => {
      console.log("json string received:", jsonString);
      voiceClient.appendLLMContext({
        role: "user",
        content: '{"baz": "quox"}',
      });
    }, [])
  );

  return (
    <div>
      <style scoped>{`
        .participants-wrapper {
          display: flex;
          gap: 8px;
        }
        .meter-wrapper {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
        }
      `}</style>
      <h1>Hello Voice Client React Demo!</h1>
      {error}
      <p>
        <strong>
          Bot is {isBotConnected ? "connected" : "not connected"} (
          {transportState})
        </strong>
      </p>
      <div className="participants-wrapper">
        <div className="meter-wrapper">
          <strong>You</strong>
          <MicMeter type={VoiceEvent.LocalAudioLevel} />
        </div>
        {isBotConnected && (
          <div className="meter-wrapper">
            <strong>Bot</strong>
            <MicMeter type={VoiceEvent.RemoteAudioLevel} />
          </div>
        )}
      </div>
      <button disabled={transportState !== "idle"} onClick={() => start()}>
        Connect
      </button>
      <button disabled={!isConnected} onClick={() => voiceClient.disconnect()}>
        Disconnect
      </button>
      <hr />
      <strong>Config:</strong>
      <textarea
        style={{ width: "100%" }}
        rows={15}
        readOnly
        value={JSON.stringify(config, null, 2)}
      />
      <hr />
      <strong>LLM Context:</strong>
      <textarea
        style={{ width: "100%" }}
        rows={10}
        defaultValue={JSON.stringify(llmContext, null, 2)}
        onChange={(e) => {
          setLlmContext(JSON.parse(e.target.value));
        }}
      />
      <button
        onClick={() => {
          voiceClient.llmContext = {
            messages: llmContext,
          };
        }}
      >
        Update LLM context
      </button>
      <hr />
      Model:
      <select
        defaultValue={voiceClient.llmContext?.model}
        onChange={(e) => {
          voiceClient.updateConfig({ llm: { model: e.target.value } }, true);
        }}
      >
        <option value="llama3-8b-8192">llama3-8b-8192</option>
        <option value="llama3-70b-8192">llama3-70b-8192</option>
      </select>
      <br />
      Voice:{" "}
      <input
        type="text"
        defaultValue={voice}
        onChange={(e) => {
          setVoice(e.target.value);
        }}
      />
      <button
        onClick={() =>
          voiceClient.updateConfig({ tts: { voice: voice } }, false, true)
        }
      >
        Update voice
      </button>
      <hr />
      <button
        onClick={() =>
          voiceClient.say("Can you believe how great Pipecat is?", true)
        }
      >
        Say "Can you believe how great Pipecat is?"
      </button>
      <button onClick={() => voiceClient.interrupt()}>Interrupt</button>
      <hr />
      <input
        type="text"
        defaultValue={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <select defaultValue={role} onChange={(e) => setRole(e.target.value)}>
        <option value="user">User</option>
        <option value="assistant">Assistant</option>
      </select>
      <button
        onClick={() => {
          voiceClient.appendLLMContext({ role: role, content: message });
          setMessage("");
        }}
      >
        Send message
      </button>
      <VoiceClientAudio />
    </div>
  );
};

type MeterType = VoiceEvent.LocalAudioLevel | VoiceEvent.RemoteAudioLevel;

interface MeterProps {
  type: MeterType;
}

const MicMeter: React.FC<MeterProps> = ({ type }) => {
  const meterRef = useRef<HTMLInputElement>(null);

  useVoiceClientEvent(
    type,
    useCallback((level: number) => {
      if (!meterRef.current) return;
      meterRef.current.style.width = 100 * Math.min(1, 3 * level) + "%";
    }, [])
  );

  useVoiceClientEvent(
    VoiceEvent.Disconnected,
    useCallback(() => {
      if (!meterRef.current) return;
      meterRef.current.style.width = "";
    }, [type])
  );

  return (
    <div
      style={{
        background: "#fafafa",
        height: "4px",
        margin: "20px 0",
        position: "relative",
        width: "150px",
      }}
    >
      <div
        ref={meterRef}
        style={{
          background: "blue",
          borderRadius: "4px",
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          transition: "width 100ms ease",
        }}
      />
    </div>
  );
};
