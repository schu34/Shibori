import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { extractSerializableState, generateShareableUrl } from '../../utils/urlStateUtils';
import './ShareControls.css';

export const ShareControls: React.FC = () => {
    const [showUrl, setShowUrl] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<string>('');
    const [shareUrl, setShareUrl] = useState<string>('');

    // Get the current state from Redux
    const currentState = useSelector((state: RootState) => state.shibori);

    const generateUrl = useCallback(() => {
        try {
            const serializableState = extractSerializableState(currentState);
            const url = generateShareableUrl(serializableState);
            setShareUrl(url);
            setShowUrl(true);
            setCopyFeedback('');
        } catch (error) {
            console.error('Error generating shareable URL:', error);
            setCopyFeedback('Failed to generate URL');
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
    }, []);

    // Check if there's anything to share (has drawing history)
    const hasContent = currentState.history.length > 0;

    return (
        <div className="share-controls">
            <h3>Share Your Drawing</h3>
            
            {!hasContent && (
                <p className="share-message">
                    Create some drawings to generate a shareable link
                </p>
            )}

            {hasContent && (
                <>
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
                </>
            )}
        </div>
    );
};