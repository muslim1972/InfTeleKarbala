import React, { useEffect, useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { VoiceRecorderInput } from './inputs/VoiceRecorderInput';
import { ImagePreviewInput } from './inputs/ImagePreviewInput';
import { FilePreviewInput } from './inputs/FilePreviewInput';
import { TextInput } from './inputs/TextInput';

interface MessageInputProps {
    onSend: (e?: React.FormEvent) => void;
    onSendVoice?: (blob: Blob) => void;
    onSendImage?: (file: File) => void;
    onSendFile?: (file: File) => void;
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}

export function MessageInput({ onSend, onSendVoice, onSendImage, onSendFile, value, onChange, disabled }: MessageInputProps) {
    const [isSendingVoice, setIsSendingVoice] = useState(false);
    
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

    const handleImageSelect = (file: File) => {
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
    };

    const handleSendImage = () => {
        if (selectedImage && onSendImage) {
            onSendImage(selectedImage);
            cancelImage();
        }
    };

    const handleSendFileClick = () => {
        if (selectedFile && onSendFile) {
            onSendFile(selectedFile);
            cancelFile();
        }
    };

    const cancelImage = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setSelectedImage(null);
        setImagePreview(null);
    };

    const cancelFile = () => {
        setSelectedFile(null);
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

    // 3. File Preview Mode
    if (selectedFile) {
        return (
            <FilePreviewInput
                selectedFile={selectedFile}
                disabled={disabled}
                onCancel={cancelFile}
                onSendFile={handleSendFileClick}
            />
        );
    }

    // 4. Normal Text Mode
    return (
        <TextInput
            value={value}
            onChange={onChange}
            onSend={onSend}
            onMicClick={handleMicClick}
            onImageSelect={handleImageSelect}
            onFileSelect={handleFileSelect}
            disabled={disabled}
        />
    );
}
