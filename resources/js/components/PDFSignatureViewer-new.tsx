import React, { useState, useRef, useCallback } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import SignatureCanvas from './SignatureCanvas';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface SignaturePosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    type: 'physical' | 'digital';
    user?: {
        id: string;
        name: string;
    };
    signedAt?: string;
}

interface PDFSignatureViewerProps {
    pdfUrl: string;
    signatures: SignaturePosition[];
    onSignaturePositionChange: (signatureId: string, position: { x: number; y: number; width: number; height: number; page: number }) => void;
    onSignatureComplete: (signatureData: string, position: { x: number; y: number; page: number }) => void;
    canEdit?: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
}

const PDFSignatureViewer: React.FC<PDFSignatureViewerProps> = ({
    pdfUrl,
    signatures,
    onSignaturePositionChange,
    onSignatureComplete,
    canEdit = false,
    currentPage,
    onPageChange
}) => {
    const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
    const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number; page: number } | null>(null);

    // Create a default layout plugin instance
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    const handlePageClick = useCallback((e: React.MouseEvent) => {
        if (!canEdit) return;
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Set position for signature canvas
        setSignaturePosition({ x, y, page: currentPage });
        setShowSignatureCanvas(true);
    }, [canEdit, currentPage]);

    const handleSignatureComplete = (signatureData: string | null) => {
        if (signaturePosition && signatureData) {
            onSignatureComplete(signatureData, signaturePosition);
            setShowSignatureCanvas(false);
            setSignaturePosition(null);
        }
    };

    const handleSignatureCancel = () => {
        setShowSignatureCanvas(false);
        setSignaturePosition(null);
    };

    return (
        <div className="pdf-signature-viewer">
            {/* Instructions */}
            {canEdit && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">Instructions:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Click on the PDF to place a signature</li>
                        <li>• Use the toolbar controls to navigate and zoom</li>
                        <li>• Your signature will create both physical and digital signatures</li>
                    </ul>
                </div>
            )}

            {/* PDF Viewer */}
            <div 
                className="relative border border-gray-300 rounded-lg overflow-hidden"
                style={{ height: '750px' }}
            >
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                    <div 
                        className="h-full relative"
                        onClick={handlePageClick}
                        style={{ cursor: canEdit ? 'crosshair' : 'default' }}
                    >
                        <Viewer 
                            fileUrl={pdfUrl}
                            plugins={[defaultLayoutPluginInstance]}
                        />

                        {/* Signature overlays */}
                        {signatures.filter(s => s.page === currentPage).map((signature) => (
                            <div
                                key={signature.id}
                                className={`absolute border-2 rounded cursor-move ${
                                    signature.type === 'physical'
                                        ? 'border-blue-500 bg-blue-100 bg-opacity-30'
                                        : 'border-green-500 bg-green-100 bg-opacity-30'
                                }`}
                                style={{
                                    left: signature.x,
                                    top: signature.y,
                                    width: signature.width,
                                    height: signature.height,
                                    zIndex: 10,
                                }}
                            >
                                <div className="p-1 text-xs">
                                    <div className="font-semibold">
                                        ✍️ {signature.user?.name || 'Unknown'}
                                    </div>
                                    {signature.signedAt && (
                                        <div className="text-gray-600">
                                            {new Date(signature.signedAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Signature Canvas Overlay */}
                        {showSignatureCanvas && signaturePosition && (
                            <div
                                className="absolute bg-white border-2 border-blue-500 rounded-lg shadow-lg z-20"
                                style={{
                                    left: signaturePosition.x,
                                    top: signaturePosition.y,
                                    minWidth: '320px',
                                }}
                            >
                                <div className="p-4">
                                    <h3 className="text-sm font-medium mb-3 text-gray-900">
                                        Sign Document (Physical + Digital)
                                    </h3>
                                    <SignatureCanvas
                                        onSignatureChange={handleSignatureComplete}
                                    />
                                    <div className="mt-3 flex justify-end space-x-2">
                                        <button
                                            onClick={handleSignatureCancel}
                                            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500">
                                        This will create both physical and digital signatures
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Worker>
            </div>
        </div>
    );
};

export default PDFSignatureViewer;