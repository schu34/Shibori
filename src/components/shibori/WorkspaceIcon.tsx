import React from 'react';

export type WorkspaceIconName =
    | 'select'
    | 'directSelect'
    | 'line'
    | 'paintbrush'
    | 'rectangle'
    | 'square'
    | 'circle'
    | 'bezier'
    | 'undo'
    | 'clear'
    | 'guides'
    | 'download'
    | 'share'
    | 'settings'
    | 'close';

interface WorkspaceIconProps {
    name: WorkspaceIconName;
    size?: number;
}

export const WorkspaceIcon: React.FC<WorkspaceIconProps> = ({ name, size = 20 }) => {
    const commonProps = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    };

    switch (name) {
        case 'select':
            return <svg {...commonProps}><path d="M5 3l13 9-6 1.5L9.5 20 5 3z" /><path d="M12 13.5l4 5" /></svg>;
        case 'directSelect':
            return <svg {...commonProps}><path d="M5 3l13 9-6 1.5L9.5 20 5 3z" /><circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" /></svg>;
        case 'line':
            return <svg {...commonProps}><path d="M5 19L19 5" /><circle cx="5" cy="19" r="1.5" /><circle cx="19" cy="5" r="1.5" /></svg>;
        case 'paintbrush':
            return <svg {...commonProps}><path d="M14 5l5 5-8.5 8.5-5-5L14 5z" /><path d="M5.5 13.5C3 16 4.5 20 1.8 21c3.8.7 6.7-.6 8.7-2.5" /><path d="M16 3l5 5-2 2-5-5 2-2z" /></svg>;
        case 'rectangle':
            return <svg {...commonProps}><rect x="3.5" y="6" width="17" height="12" rx="1" /></svg>;
        case 'square':
            return <svg {...commonProps}><rect x="5" y="5" width="14" height="14" rx="1" /></svg>;
        case 'circle':
            return <svg {...commonProps}><circle cx="12" cy="12" r="7" /></svg>;
        case 'bezier':
            return <svg {...commonProps}><path d="M4 17C7 4 17 20 20 7" /><path d="M4 7h16" strokeDasharray="2 2" /><circle cx="4" cy="17" r="1.5" /><circle cx="20" cy="7" r="1.5" /><circle cx="4" cy="7" r="1" /><circle cx="20" cy="7" r="1" /></svg>;
        case 'undo':
            return <svg {...commonProps}><path d="M9 8H4V3" /><path d="M4 8c2.1-2.7 5-4 8.4-3.5A8 8 0 112 13" /></svg>;
        case 'clear':
            return <svg {...commonProps}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M7 7l1 13h8l1-13" /><path d="M10 11v5M14 11v5" /></svg>;
        case 'guides':
            return <svg {...commonProps}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 3v18M3 12h18M3 3l18 18M21 3L3 21" strokeDasharray="2 2" /></svg>;
        case 'download':
            return <svg {...commonProps}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></svg>;
        case 'share':
            return <svg {...commonProps}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.3 10.9l7.4-4.6M8.3 13.1l7.4 4.6" /></svg>;
        case 'settings':
            return <svg {...commonProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 009 4.6 1.7 1.7 0 0010 3V2.8h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z" /></svg>;
        case 'close':
            return <svg {...commonProps}><path d="M5 5l14 14M19 5L5 19" /></svg>;
    }
};
