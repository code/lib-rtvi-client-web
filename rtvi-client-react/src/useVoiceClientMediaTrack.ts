import { atom, useAtomValue } from "jotai";
import { atomFamily, useAtomCallback } from "jotai/utils";
import { PrimitiveAtom } from "jotai/vanilla";
import { useCallback, useEffect } from "react";
import { Tracks, VoiceEvent } from "realtime-ai";
import { useVoiceClient } from "./useVoiceClient";
import { useVoiceClientEvent } from "./useVoiceClientEvent";

type ParticipantType = keyof Tracks;
type TrackType = keyof Tracks["local"];

const localAudioTrackAtom = atom<MediaStreamTrack | null>(null);
const localVideoTrackAtom = atom<MediaStreamTrack | null>(null);
const botAudioTrackAtom = atom<MediaStreamTrack | null>(null);
const botVideoTrackAtom = atom<MediaStreamTrack | null>(null);

const trackAtom = atomFamily<
  { local: boolean; trackType: TrackType },
  PrimitiveAtom<MediaStreamTrack | null>
>(({ local, trackType }) => {
  if (local)
    return trackType === "audio" ? localAudioTrackAtom : localVideoTrackAtom;
  return trackType === "audio" ? botAudioTrackAtom : botVideoTrackAtom;
});

export const useVoiceClientMediaTrack = (
  trackType: TrackType,
  participantType: ParticipantType
) => {
  const voiceClient = useVoiceClient();
  const track = useAtomValue(
    trackAtom({ local: participantType === "local", trackType })
  );

  const updateTrack = useAtomCallback(
    useCallback(
      (
        get,
        set,
        track: MediaStreamTrack,
        trackType: TrackType,
        local: boolean
      ) => {
        const atom = trackAtom({
          local,
          trackType,
        });
        const oldTrack = get(atom);
        if (oldTrack?.id === track.id) return;
        set(atom, track);
      },
      [participantType, track, trackType]
    )
  );

  useVoiceClientEvent(
    VoiceEvent.TrackStarted,
    useCallback((track, participant) => {
      updateTrack(track, track.kind as TrackType, Boolean(participant?.local));
    }, [])
  );

  useEffect(() => {
    if (!voiceClient) return;
    const tracks = voiceClient.tracks();
    const track = tracks?.[participantType]?.[trackType];
    if (!track) return;
    updateTrack(track, trackType, participantType === "local");
  }, [participantType, trackType, updateTrack, voiceClient]);

  return track;
};