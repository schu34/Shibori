import React, { useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
    encodeShareableState,
    extractSerializableState,
    generateShareableUrl,
    MAX_SHARE_PARAMETER_LENGTH,
} from '../../utils/urlStateUtils';
import './ShareControls.css';

export const ShareControls: React.FC = () => {
    const [showUrl, setShowUrl] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<string>('');
    const [shareUrl, setShareUrl] = useState<string>('');
    const [shareError, setShareError] = useState<string>('');

    // Get the current state from Redux
    const currentState = useSelector((state: RootState) => state.shibori);

    const generateUrl = useCallback(() => {
        try {
            const serializableState = extractSerializableState(currentState);
            const result = generateShareableUrl(serializableState);
            if (result.kind !== 'success') {
                setShowUrl(false);
                setShareUrl('');
                setCopyFeedback('');
                setShareError(result.kind === 'too-large'
                    ? `This design is too large for a share link (${formatKiB(result.maxLength)} KiB limit).`
                    : 'Unable to generate a share link for this design.');
                return;
            }

            setShareUrl(result.url);
            setShowUrl(true);
            setCopyFeedback('');
            setShareError('');
        } catch (error) {
            console.error('Error generating shareable URL:', error);
            setShowUrl(false);
            setShareUrl('');
            setCopyFeedback('');
            setShareError('Unable to generate a share link for this design.');
        }
    }, [currentState]);

    const copyToClipboard = useCallback(async () => {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopyFeedback('Copied to clipboard!');
            setTimeout(() => setCopyFeedback(''), 3000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            setCopyFeedback('Failed to copy');
            setTimeout(() => setCopyFeedback(''), 3000);
        }
    }, [shareUrl]);

    const closeUrlDisplay = useCallback(() => {
        setShowUrl(false);
        setShareUrl('');
        setCopyFeedback('');
        setShareError('');
    }, []);

    // Check if there's anything to share (has drawing history)
    const hasContent = currentState.history.length > 0;
    const shareEncoding = useMemo(
        () => hasContent ? encodeShareableState(extractSerializableState(currentState)) : null,
        [currentState, hasContent]
    );
    const shareSize = shareEncoding && shareEncoding.kind !== 'invalid-state'
        ? shareEncoding.encodedLength
        : null;
    const isOverSizeLimit = shareEncoding?.kind === 'too-large';

    return (
        <div className="share-controls">
            <h3>Share Pattern</h3>
            
            {!hasContent && (
                <p className="share-message">
                    Draw a pattern to generate a shareable link.
                </p>
            )}

            {hasContent && (
                <>
                    {shareSize !== null && (
                        <div
                            className={`share-link-size${isOverSizeLimit ? ' share-link-size-over-limit' : ''}`}
                            data-testid="share-link-size"
                        >
                            <span>Live link size</span>
                            <strong>{formatKiB(shareSize)} KiB / {formatKiB(MAX_SHARE_PARAMETER_LENGTH)} KiB</strong>
                        </div>
                    )}

                    <button 
                        onClick={generateUrl}
                        className="generate-link-btn"
                        disabled={!hasContent}
                    >
                        Generate Share Link
                    </button>

                    {showUrl && (
                        <div className="url-display">
                            <div className="url-container">
                                <input 
                                    type="text" 
                                    value={shareUrl}
                                    readOnly
                                    className="url-input"
                                />
                                <button 
                                    onClick={copyToClipboard}
                                    className="copy-btn"
                                    title="Copy to clipboard"
                                >
                                    📋
                                </button>
                                <button 
                                    onClick={closeUrlDisplay}
                                    className="close-btn"
                                    title="Close"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {copyFeedback && (
                                <div className={`copy-feedback ${copyFeedback.includes('Failed') ? 'error' : 'success'}`}>
                                    {copyFeedback}
                                </div>
                            )}
                            
                            <p className="url-info">
                                Share this link to let others view your drawing with the same fold settings.
                            </p>
                        </div>
                    )}

                    {shareError && (
                        <p className="share-error" role="status" aria-live="polite">
                            {shareError}
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

function formatKiB(bytes: number): string {
    return (bytes / 1024).toFixed(Number.isInteger(bytes / 1024) ? 0 : 1);
}
