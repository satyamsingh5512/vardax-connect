import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';

interface CarouselItem {
  id: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  image?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AdvancedCarouselProps {
  items: CarouselItem[];
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  showProgress?: boolean;
  className?: string;
}

export function AdvancedCarousel({
  items,
  autoplay = false,
  autoplayDelay = 5000,
  loop = true,
  showDots = true,
  showArrows = true,
  showProgress = true,
  className = ''
}: AdvancedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop,
    skipSnaps: false,
    dragFree: false
  });
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [progress, setProgress] = useState(0);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  const toggleAutoplay = () => {
    setIsPlaying(!isPlaying);
  };

  const resetCarousel = () => {
    if (emblaApi) {
      emblaApi.scrollTo(0);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay functionality
  useEffect(() => {
    if (!emblaApi || !isPlaying) return;

    const interval = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else if (loop) {
        emblaApi.scrollTo(0);
      } else {
        setIsPlaying(false);
      }
    }, autoplayDelay);

    return () => clearInterval(interval);
  }, [emblaApi, isPlaying, autoplayDelay, loop]);

  // Progress tracking
  useEffect(() => {
    if (!isPlaying) return;

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / autoplayDelay) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        setProgress(0);
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [selectedIndex, isPlaying, autoplayDelay]);

  return (
    <div className={`relative ${className}`}>
      {/* Main Carousel */}
      <div className="overflow-hidden rounded-xl" ref={emblaRef}>
        <div className="flex">
          {items.map((item, index) => (
            <div key={item.id} className="flex-[0_0_100%] min-w-0">
              <CarouselSlide 
                item={item} 
                isActive={index === selectedIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {showArrows && items.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {autoplay && (
          <button
            onClick={toggleAutoplay}
            className="w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={resetCarousel}
          className="w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {showProgress && isPlaying && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-black/20 z-10">
          <motion.div
            className="h-full bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}

      {/* Dots Navigation */}
      {showDots && items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === selectedIndex 
                  ? 'bg-white w-6' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}

      {/* Slide Counter */}
      <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/50 text-white text-sm rounded-full backdrop-blur-sm z-10">
        {selectedIndex + 1} / {items.length}
      </div>
    </div>
  );
}

function CarouselSlide({ 
  item, 
  isActive 
}: { 
  item: CarouselItem; 
  isActive: boolean;
}) {
  return (
    <div className="relative h-96 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      {/* Background Image */}
      {item.image && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${item.image})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Content */}
      <div className="relative h-full flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl"
            >
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-3xl font-bold text-white mb-4"
              >
                {item.title}
              </motion.h2>
              
              {item.subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-lg text-slate-300 mb-6"
                >
                  {item.subtitle}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mb-6"
              >
                {item.content}
              </motion.div>

              {item.action && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  onClick={item.action.onClick}
                  className="btn btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item.action.label}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}