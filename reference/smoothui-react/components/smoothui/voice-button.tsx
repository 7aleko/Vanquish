"use client";

import { useAudioAmplitude, useSimulatedAmplitude } from "@/components/smoothui/ai-core";
import SiriOrb from "@/components/smoothui/siri-orb";
import { useState } from "react";

export interface VoiceButtonProps {
  className?: string;
  size?: string;
  useMicrophone?: boolean;
  onToggle?: (isActive: boolean) => void;
}

export const VoiceButton = ({
  className,
  size = "96px",
  useMicrophone = false,
  onToggle,
}: VoiceButtonProps = {}) => {
  const [active, setActive] = useState(false);
  const simulatedAmplitude = useSimulatedAmplitude(active ? "listening" : "idle");
  const { amplitude: micAmplitude, status, start, stop } = useAudioAmplitude();

  const isMicActive = status === "active";
  const isActive = useMicrophone ? isMicActive : active;
  const currentAmplitude = useMicrophone ? micAmplitude : simulatedAmplitude;

  const handleClick = () => {
    if (useMicrophone) {
      if (isMicActive) {
        stop();
        onToggle?.(false);
      } else {
        start();
        onToggle?.(true);
      }
    } else {
      const next = !active;
      setActive(next);
      onToggle?.(next);
    }
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={className}
      aria-label="Toggle AI Assistant"
    >
      <SiriOrb
        amplitude={currentAmplitude}
        size={size}
        state={isActive ? "listening" : "idle"}
      />
    </button>
  );
};

export default VoiceButton;
