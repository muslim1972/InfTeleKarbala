import React, { useRef, useEffect, useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { VoiceRecorderInput } from './inputs/VoiceRecorderInput';
import { ImagePreviewInput } from './inputs/ImagePreviewInput';
import { TextInput } from './inputs/TextInput';

interface MessageInputProps {
    onSend: (e?: React.FormEvent) => void;
    onSendVoice?: (blob: Blob) => void;
    onSendImage?: (file: File) => void;
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

export function MessageInput({ onSend, onSendVoice, onSendImage, value, onChange, disabled }: MessageInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSendingVoice, setIsSendingVoice] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const {
        isRecording,
        formattedDuration,
        waveformData,
        error,
        startRecording,
        stopRecording,
        cancelRecording,
    } = useVoiceRecorder();

    // Show error toast
    useEffect(() => {
        if (error) {
            alert(error);
        }
    }, [error]);

    const handleMicClick = async () => {
        if (isRecording) return;
        await startRecording();
    };

    const handleSendVoice = async () => {
        if (!isRecording || !onSendVoice) return;
        setIsSendingVoice(true);
        try {
            const blob = await stopRecording();
            if (blob && blob.size > 0) {
                await onSendVoice(blob);
            }
        } finally {
            setIsSendingVoice(false);
        }
    };

    const handleCancelVoice = () => {
        cancelRecording();
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
        // Reset file input so the same file can be selected again
        e.target.value = '';
    };

    const handleSendImage = () => {
        if (selectedImage && onSendImage) {
            onSendImage(selectedImage);
            cancelImage();
        }
    };

    const cancelImage = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setSelectedImage(null);
        setImagePreview(null);
    };

    // ─── Render Coordinations ─── //

    // 1. Voice Recording Mode
    if (isRecording) {
        return (
            <VoiceRecorderInput
                formattedDuration={formattedDuration}
                waveformData={waveformData}
                isSendingVoice={isSendingVoice}
                onCancel={handleCancelVoice}
                onSendVoice={handleSendVoice}
            />
        );
    }

    // 2. Image Preview Mode
    if (selectedImage && imagePreview) {
        return (
            <ImagePreviewInput
                selectedImage={selectedImage}
                imagePreview={imagePreview}
                disabled={disabled}
                onCancel={cancelImage}
                onSendImage={handleSendImage}
            />
        );
    }

    // 3. Normal Text Mode
    return (
        <>
            {/* Hidden file input controlled by TextInput's image button */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
            />
            <TextInput
                value={value}
                onChange={onChange}
                onSend={onSend}
                onMicClick={handleMicClick}
                onImageClick={() => fileInputRef.current?.click()}
                disabled={disabled}
            />
        </>
    );
}
