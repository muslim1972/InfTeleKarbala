import React from 'react';
import { useCall } from '../../context/CallContext';
import { CallOverlay } from './CallOverlay';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';

export const CallOverlayWrapper: React.FC = () => {
  const { status, livekitToken, isVideoCall, endCall } = useCall();

  if (status === 'idle') return null;

  // Render the LiveKit room if the call is active and token is available
  if (status === 'active' && livekitToken) {
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
    if (!livekitUrl) {
      console.error('VITE_LIVEKIT_URL is not set!');
      return null;
    }

    return (
      <LiveKitRoom
        video={isVideoCall}
        audio={true}
        token={livekitToken}
        serverUrl={livekitUrl}
        onDisconnected={endCall}
        connect={true}
        // Use custom styling or display contents to prevent wrapping divs from breaking layout
        style={{ display: 'contents' }}
      >
        <CallOverlay />
      </LiveKitRoom>
    );
  }

  // Render just the overlay (for ringing state)
  return <CallOverlay />;
};
