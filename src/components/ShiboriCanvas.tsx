import { useCallback, useEffect, useState } from 'react';
import { FoldControls } from './shibori/FoldControls';
import { DimensionControls } from './shibori/DimensionControls';
import { CanvasDisplay } from './shibori/CanvasDisplay';
import { ToolControls } from './shibori/ToolControls';
import { ShareControls } from './shibori/ShareControls';
import { ToolSelector } from './shibori/ToolSelector';
import { WorkspaceIcon } from './shibori/WorkspaceIcon';
import { useAppSelector } from '../hooks/useReduxHooks';
import './ShiboriCanvas.css';

type CanvasView = 'folded' | 'unfolded';
type InspectorSection = 'folds' | 'canvas' | 'share';

const ShiboriCanvas = () => {
    const currentTool = useAppSelector((state) => state.shibori.currentTool);
    const [isInspectorOpen, setIsInspectorOpen] = useState(() => (
        typeof window === 'undefined' || !window.matchMedia?.('(max-width: 900px)').matches
    ));
    const [activeCanvas, setActiveCanvas] = useState<CanvasView>('folded');
    const [expandedSections, setExpandedSections] = useState<Record<InspectorSection, boolean>>({
        folds: true,
        canvas: false,
        share: false,
    });

    const toggleSection = useCallback((section: InspectorSection) => {
        setExpandedSections((sections) => ({ ...sections, [section]: !sections[section] }));
    }, []);

    const openShare = useCallback(() => {
        setIsInspectorOpen(true);
        setExpandedSections((sections) => ({ ...sections, share: true }));
    }, []);

    useEffect(() => {
        if (!isInspectorOpen) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsInspectorOpen(false);
        };

        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isInspectorOpen]);

    return (
        <div className={`shibori-app${isInspectorOpen ? '' : ' inspector-collapsed'}`}>
            <header className="app-header">
                <div className="app-brand">
                    <span className="app-mark" aria-hidden="true">染</span>
                    <h1><span>Shibori</span> <span className="app-title-suffix">Folding</span></h1>
                </div>
            </header>

            <nav className="tool-rail" aria-label="Drawing toolbar">
                <ToolSelector currentTool={currentTool} />
            </nav>

            <main className="workspace-stage">
                <CanvasDisplay
                    activeCanvas={activeCanvas}
                    isInspectorOpen={isInspectorOpen}
                    onActiveCanvasChange={setActiveCanvas}
                    onOpenShare={openShare}
                    onToggleInspector={() => setIsInspectorOpen((open) => !open)}
                />
            </main>

            <button
                type="button"
                className={`inspector-backdrop${isInspectorOpen ? ' is-visible' : ''}`}
                aria-label="Close properties"
                aria-hidden={!isInspectorOpen}
                tabIndex={isInspectorOpen ? 0 : -1}
                onClick={() => setIsInspectorOpen(false)}
            />

            <aside className="properties-inspector" aria-label="Properties" aria-hidden={!isInspectorOpen}>
                <div className="inspector-header">
                    <div>
                        <span className="inspector-eyebrow">Properties</span>
                        <h2>Tool options</h2>
                    </div>
                    <button
                        type="button"
                        className="icon-button inspector-close"
                        onClick={() => setIsInspectorOpen(false)}
                        aria-label="Close properties"
                        data-tooltip="Close properties"
                    >
                        <WorkspaceIcon name="close" size={18} />
                    </button>
                </div>

                <section className="inspector-tool-options" aria-label="Tool options">
                    <ToolControls />
                </section>

                <InspectorPanel
                    title="Folds"
                    expanded={expandedSections.folds}
                    onToggle={() => toggleSection('folds')}
                >
                    <FoldControls />
                </InspectorPanel>
                <InspectorPanel
                    title="Canvas size"
                    expanded={expandedSections.canvas}
                    onToggle={() => toggleSection('canvas')}
                >
                    <DimensionControls />
                </InspectorPanel>
                <InspectorPanel
                    title="Share"
                    expanded={expandedSections.share}
                    onToggle={() => toggleSection('share')}
                >
                    <ShareControls />
                </InspectorPanel>
            </aside>
        </div>
    );
};

interface InspectorPanelProps {
    title: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ title, expanded, onToggle, children }) => (
    <section className={`inspector-panel${expanded ? ' is-expanded' : ''}`}>
        <button
            type="button"
            className="inspector-panel-toggle"
            aria-expanded={expanded}
            onClick={onToggle}
        >
            <span>{title}</span>
            <span className="inspector-chevron" aria-hidden="true">⌄</span>
        </button>
        {expanded && <div className="inspector-panel-content">{children}</div>}
    </section>
);

export default ShiboriCanvas;
