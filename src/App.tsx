import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Image as ImageIcon, 
  Layers, 
  Zap, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  Maximize2,
  Settings2,
  Sparkles,
  Trash2,
  CheckCircle2,
  Loader2,
  Cpu,
  RefreshCw,
  User,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { cn, fileToBase64, downloadImage } from './lib/utils';
import { 
  enhanceImage, 
  EnhancementOptions, 
  EnhancementMode, 
  ResolutionPreset, 
  UpscaleFactor 
} from './services/geminiService';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  processed?: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  error?: string;
}

const MODES: { id: EnhancementMode; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'standard', label: 'Standard', icon: <ImageIcon size={18} />, description: 'Balanced enhancement for any image' },
  { id: 'ultra-hd', label: 'Ultra HD', icon: <Sparkles size={18} />, description: 'Maximum detail restoration (Topaz style)' },
  { id: 'portrait', label: 'Portrait', icon: <User size={18} />, description: 'Focus on skin, eyes, and hair details' },
  { id: 'anime', label: 'Anime', icon: <Palette size={18} />, description: 'Clean lines and vibrant colors for art' },
  { id: 'denoise', label: 'Denoise', icon: <Layers size={18} />, description: 'Remove grain while keeping sharpness' },
  { id: 'sharpen', label: 'Sharpen', icon: <Zap size={18} />, description: 'Fix blurry edges naturally' },
];

const RESOLUTIONS: ResolutionPreset[] = ['1080p', '2k', '4k'];
const UPSCALES: UpscaleFactor[] = ['2x', '4x', '8x'];

export default function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<EnhancementOptions>({
    mode: 'standard',
    resolution: '1080p',
    upscale: '2x',
    faceEnhancement: true,
    noiseReduction: 50,
    sharpening: 50,
  });
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: 'idle' as const,
    }));
    setImages(prev => [...prev, ...newImages]);
    if (images.length === 0) setSelectedIndex(0);
  }, [images.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    multiple: true
  } as any);

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
      return filtered;
    });
  };

  const processImage = async (index: number) => {
    const img = images[index];
    if (!img || img.status === 'processing') return;

    setImages(prev => prev.map((item, i) => i === index ? { ...item, status: 'processing' } : item));

    try {
      const base64 = await fileToBase64(img.file);
      const processed = await enhanceImage(base64, img.file.type, options);
      
      setImages(prev => prev.map((item, i) => i === index ? { 
        ...item, 
        processed, 
        status: 'completed' 
      } : item));
      
      if (index === selectedIndex) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#ffffff']
        });
      }
    } catch (error) {
      setImages(prev => prev.map((item, i) => i === index ? { 
        ...item, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      } : item));
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    for (let i = 0; i < images.length; i++) {
      if (images[i].status !== 'completed') {
        await processImage(i);
      }
    }
    setIsProcessingAll(false);
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  };

  const currentImage = images[selectedIndex];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Left Sidebar - Image Queue */}
      <div className="w-full md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col h-[20vh] md:h-full shrink-0 z-30">
        <div className="p-3 md:p-5 border-b border-[#1a1a1a] flex items-center justify-between md:block bg-[#050505]/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-2 mb-0 md:mb-1">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Sparkles size={14} className="text-white" />
            </div>
            <h1 className="text-xs md:text-base font-bold tracking-tight">Bugzy AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[7px] md:text-[9px] text-gray-600 font-mono uppercase tracking-[0.2em]">v2.5</p>
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="lg:hidden p-1.5 bg-[#1a1a1a] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <Settings2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto md:overflow-y-auto p-2 md:p-3 flex md:flex-col gap-2 md:space-y-2 scrollbar-thin bg-[#080808] no-scrollbar">
          <div 
            {...getRootProps()} 
            className={cn(
              "border-2 border-dashed rounded-xl p-2 transition-all cursor-pointer text-center group shrink-0 md:shrink",
              "w-24 md:w-full flex flex-col justify-center items-center h-full md:h-auto",
              isDragActive ? "border-blue-500 bg-blue-500/10" : "border-[#1a1a1a] hover:border-gray-700"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mb-1 text-gray-600 group-hover:text-blue-400 transition-colors" size={16} />
            <p className="text-[8px] md:text-xs font-medium text-gray-500">Add</p>
          </div>

          <div className="flex md:flex-col gap-2">
            {images.map((img, idx) => (
              <motion.div
                layout
                key={img.id}
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  "relative group rounded-lg p-1.5 flex md:flex-row flex-col items-center gap-2 md:gap-3 cursor-pointer transition-all border shrink-0 md:shrink",
                  "w-20 md:w-full",
                  selectedIndex === idx ? "bg-[#111] border-blue-500/40" : "border-transparent hover:bg-[#111]"
                )}
              >
                <div className="relative w-9 h-9 md:w-11 md:h-11 rounded overflow-hidden bg-black flex-shrink-0">
                  <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                  {img.status === 'processing' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                    </div>
                  )}
                  {img.status === 'completed' && (
                    <div className="absolute top-0 right-0 p-0.5 bg-green-500 rounded-bl">
                      <CheckCircle2 size={8} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <p className="text-[9px] md:text-xs font-medium truncate text-gray-400">{img.file.name}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                  className="md:opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all absolute top-0 right-0 md:relative"
                >
                  <Trash2 size={10} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {images.length > 0 && (
          <div className="p-3 border-t border-[#1a1a1a] bg-[#050505] hidden md:block">
            <button
              disabled={isProcessingAll}
              onClick={processAll}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              {isProcessingAll ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              <span className="text-xs uppercase tracking-widest">Process All</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Main Preview Area */}
        <div className="flex-1 flex flex-col bg-[#050505] relative">
          <div className="min-h-12 py-1.5 border-b border-[#1a1a1a] flex items-center justify-between px-4 md:px-6 bg-[#0a0a0a]/80 backdrop-blur-xl gap-2 z-10">
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em]">View</span>
              <div className="flex bg-[#111] rounded-lg p-1 border border-[#1a1a1a]">
                <button 
                  onClick={() => setViewMode('slider')}
                  className={cn(
                    "px-2 md:px-3 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-tighter rounded transition-all",
                    viewMode === 'slider' ? "bg-[#1a1a1a] text-blue-400" : "text-gray-600 hover:text-gray-400"
                  )}
                >
                  Slider
                </button>
                <button 
                  onClick={() => setViewMode('side-by-side')}
                  className={cn(
                    "px-2 md:px-3 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-tighter rounded transition-all",
                    viewMode === 'side-by-side' ? "bg-[#1a1a1a] text-blue-400" : "text-gray-600 hover:text-gray-400"
                  )}
                >
                  Split
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentImage?.status === 'completed' && (
                <button 
                  onClick={() => downloadImage(currentImage.processed!, `bugzy_${currentImage.file.name}`)}
                  className="flex items-center gap-2 px-3 md:px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] md:text-xs font-bold hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  <Download size={14} />
                  <span className="hidden xs:inline">Save Result</span>
                  <span className="xs:hidden">Save</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 md:p-8">
            <AnimatePresence mode="wait">
              {!currentImage ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-4"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0a0a0a] rounded-3xl flex items-center justify-center mx-auto border border-[#1a1a1a]">
                    <ImageIcon size={32} className="text-gray-700" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold">No Image</h2>
                    <p className="text-gray-600 text-xs md:text-sm">Upload to begin enhancement</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key={currentImage.id + viewMode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  {/* Error Message */}
                  {currentImage.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 z-50">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md text-center space-y-4 backdrop-blur-xl">
                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                          <Trash2 className="text-red-500" size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-red-400">Enhancement Failed</h3>
                          <p className="text-sm text-red-300/70 mt-1 leading-relaxed">
                            {currentImage.error || "An unexpected error occurred while processing your image."}
                          </p>
                        </div>
                        <button 
                          onClick={() => processImage(selectedIndex)}
                          className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}

                  {viewMode === 'slider' ? (
                    <div 
                      ref={sliderRef}
                      className="relative max-w-full max-h-full aspect-auto rounded-2xl overflow-hidden border border-[#1a1a1a] shadow-2xl group cursor-col-resize"
                      onMouseMove={handleSliderMove}
                      onTouchMove={handleSliderMove}
                    >
                      {/* Original Image */}
                      <img 
                        src={currentImage.preview} 
                        alt="original" 
                        className="max-h-[50vh] md:max-h-[70vh] w-auto block select-none"
                      />
                      
                      {/* Processed Image (Overlay) */}
                      {currentImage.processed && (
                        <div 
                          className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ width: `${sliderPos}%` }}
                        >
                          <img 
                            src={currentImage.processed} 
                            alt="processed" 
                            className="max-h-[50vh] md:max-h-[70vh] w-auto block max-w-none select-none"
                            style={{ width: sliderRef.current?.offsetWidth }}
                          />
                        </div>
                      )}

                      {/* Slider Control */}
                      {currentImage.processed && (
                        <div 
                          className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10 pointer-events-none"
                          style={{ left: `${sliderPos}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-xl">
                            <div className="flex gap-0.5">
                              <ChevronLeft size={10} className="text-black" />
                              <ChevronRight size={10} className="text-black" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Labels */}
                      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[8px] font-mono uppercase tracking-widest pointer-events-none">
                        Before
                      </div>
                      {currentImage.processed && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-blue-600/80 backdrop-blur-md rounded text-[8px] font-mono uppercase tracking-widest pointer-events-none">
                          After
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-3 w-full h-full items-center justify-center p-1 md:p-4">
                      <div className="relative rounded-xl overflow-hidden border border-[#1a1a1a] shadow-xl max-w-full md:max-w-[48%] max-h-[35vh] md:max-h-full">
                        <img src={currentImage.preview} alt="original" className="max-h-full w-auto block object-contain mx-auto" />
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[7px] md:text-[8px] font-mono uppercase tracking-widest">Original</div>
                      </div>
                      <div className="relative rounded-xl overflow-hidden border border-blue-500/30 shadow-xl max-w-full md:max-w-[48%] max-h-[35vh] md:max-h-full">
                        {currentImage.processed ? (
                          <>
                            <img src={currentImage.processed} alt="enhanced" className="max-h-full w-auto block object-contain mx-auto" />
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-blue-600/80 backdrop-blur-md rounded text-[7px] md:text-[8px] font-mono uppercase tracking-widest">Enhanced</div>
                          </>
                        ) : (
                          <div className="aspect-video w-full min-w-[150px] bg-[#0a0a0a] flex items-center justify-center text-gray-700 text-[8px] uppercase tracking-widest">Processing...</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scanning Line Effect during processing */}
                  {currentImage.status === 'processing' && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-full h-1 bg-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.8)] scan-line absolute top-0" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Controls */}
          <div className="py-3 md:py-5 border-t border-[#1a1a1a] bg-[#0a0a0a] flex flex-col md:flex-row items-center justify-between px-4 md:px-8 gap-4 md:gap-8 z-20 sticky bottom-0">
            <div className="flex items-center gap-4 w-full md:w-auto justify-center">
              <button 
                onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
                disabled={selectedIndex === 0}
                className="p-1.5 hover:bg-[#111] rounded-lg disabled:opacity-20 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center min-w-[60px]">
                <p className="text-[8px] font-mono text-gray-600 uppercase tracking-tighter">Queue</p>
                <p className="text-xs font-bold">{images.length > 0 ? selectedIndex + 1 : 0} / {images.length}</p>
              </div>
              <button 
                onClick={() => setSelectedIndex(prev => Math.min(images.length - 1, prev + 1))}
                disabled={selectedIndex === images.length - 1}
                className="p-1.5 hover:bg-[#111] rounded-lg disabled:opacity-20 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="hidden md:block h-8 w-px bg-[#1a1a1a]" />

            <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-center overflow-x-auto no-scrollbar">
              <div className="flex flex-col items-center shrink-0">
                <p className="text-[8px] font-mono text-gray-600 uppercase mb-1 tracking-tighter">Resolution</p>
                <div className="flex bg-[#111] rounded-lg p-0.5 border border-[#1a1a1a]">
                  {RESOLUTIONS.map(res => (
                    <button
                      key={res}
                      onClick={() => setOptions(prev => ({ ...prev, resolution: res }))}
                      className={cn(
                        "px-2 md:px-3 py-1 text-[8px] md:text-[9px] font-bold uppercase rounded transition-all",
                        options.resolution === res ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-600 hover:text-gray-400"
                      )}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center shrink-0">
                <p className="text-[8px] font-mono text-gray-600 uppercase mb-1 tracking-tighter">Upscale</p>
                <div className="flex bg-[#111] rounded-lg p-0.5 border border-[#1a1a1a]">
                  {UPSCALES.map(factor => (
                    <button
                      key={factor}
                      onClick={() => setOptions(prev => ({ ...prev, upscale: factor }))}
                      className={cn(
                        "px-2 md:px-3 py-1 text-[8px] md:text-[9px] font-bold uppercase rounded transition-all",
                        options.upscale === factor ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-600 hover:text-gray-400"
                      )}
                    >
                      {factor}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden md:block h-8 w-px bg-[#1a1a1a]" />

            <button
              disabled={!currentImage || currentImage.status === 'processing'}
              onClick={() => processImage(selectedIndex)}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center active:scale-95",
                currentImage?.status === 'completed' 
                  ? "bg-green-600/10 text-green-400 border border-green-600/20" 
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
              )}
            >
              {currentImage?.status === 'processing' ? (
                <Loader2 className="animate-spin" size={16} />
              ) : currentImage?.status === 'completed' ? (
                <RefreshCw size={16} />
              ) : (
                <Zap size={16} />
              )}
              <span className="text-[10px] uppercase tracking-widest">
                {currentImage?.status === 'completed' ? 'Re-process' : 'Enhance'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Sidebar - Advanced Options */}
        <div className={cn(
          "fixed lg:relative inset-0 lg:inset-auto w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-[#1a1a1a] bg-[#0a0a0a] p-4 lg:p-5 space-y-6 overflow-y-auto h-full shrink-0 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0",
          showOptions ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}>
          <div className="flex items-center justify-between lg:hidden mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest">Settings</h3>
            <button 
              onClick={() => setShowOptions(false)}
              className="p-2 bg-[#1a1a1a] rounded-lg"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-500">
              <Settings2 size={14} />
              <h3 className="text-[9px] font-bold uppercase tracking-[0.2em]">Enhancement Mode</h3>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
              {MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setOptions(prev => ({ ...prev, mode: mode.id }))}
                  className={cn(
                    "flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center gap-1.5 active:scale-95",
                    options.mode === mode.id 
                      ? "bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.05)]" 
                      : "bg-[#111] border-transparent text-gray-500 hover:border-gray-800 hover:text-gray-400"
                  )}
                >
                  <div className={cn(
                    "transition-transform duration-300",
                    options.mode === mode.id ? "scale-110" : "scale-100"
                  )}>
                    {mode.icon}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{mode.label}</span>
                </button>
              ))}
            </div>
            <div className="p-2.5 bg-[#111] rounded-lg border border-[#1a1a1a]">
              <p className="text-[9px] text-gray-500 leading-relaxed">
                {MODES.find(m => m.id === options.mode)?.description}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-2 text-gray-500">
              <Maximize2 size={14} />
              <h3 className="text-[9px] font-bold uppercase tracking-[0.2em]">Refinement</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-[9px] font-mono text-gray-500 uppercase tracking-tighter">
                  <span>Noise Reduction</span>
                  <span className="text-blue-400">{options.noiseReduction}%</span>
                </div>
                <div className="relative h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300"
                    style={{ width: `${options.noiseReduction}%` }}
                  />
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={options.noiseReduction}
                    onChange={(e) => setOptions(prev => ({ ...prev, noiseReduction: parseInt(e.target.value) }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between text-[9px] font-mono text-gray-500 uppercase tracking-tighter">
                  <span>Sharpening</span>
                  <span className="text-blue-400">{options.sharpening}%</span>
                </div>
                <div className="relative h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300"
                    style={{ width: `${options.sharpening}%` }}
                  />
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={options.sharpening}
                    onChange={(e) => setOptions(prev => ({ ...prev, sharpening: parseInt(e.target.value) }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-2.5 bg-[#111] rounded-xl cursor-pointer hover:bg-[#161616] transition-all border border-transparent hover:border-[#222]">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    options.faceEnhancement ? "bg-blue-600/20 text-blue-400" : "bg-[#1a1a1a] text-gray-600"
                  )}>
                    <User size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold">Face Restore</p>
                    <p className="text-[8px] text-gray-500">AI Portrait Recovery</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={options.faceEnhancement}
                  onChange={(e) => setOptions(prev => ({ ...prev, faceEnhancement: e.target.checked }))}
                  className="hidden"
                />
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-all",
                  options.faceEnhancement ? "bg-blue-600" : "bg-[#222]"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    options.faceEnhancement ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <div className="p-3 bg-blue-600/5 border border-blue-500/10 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400/70">
                  <Cpu size={12} />
                  <span className="text-[8px] font-bold uppercase tracking-widest">Engine Status</span>
                </div>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  process.env.GEMINI_API_KEY ? "bg-green-500" : "bg-red-500"
                )} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-gray-600">API KEY</span>
                  <span className={cn(
                    "text-[8px] font-mono font-bold",
                    process.env.GEMINI_API_KEY ? "text-green-500" : "text-red-500"
                  )}>
                    {process.env.GEMINI_API_KEY ? "DETECTED" : "MISSING"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[8px] text-gray-600">AI Model</span>
                  <span className="text-[8px] font-mono text-blue-400/80">GEMINI-2.5</span>
                </div>
                {!process.env.GEMINI_API_KEY && (
                  <p className="text-[7px] text-red-400/60 leading-tight mt-1">
                    Please add GEMINI_API_KEY to Vercel and Redeploy.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
