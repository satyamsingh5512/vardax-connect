import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ModalType = 'default' | 'success' | 'warning' | 'error' | 'info';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  type?: ModalType;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]'
};

const typeIcons = {
  default: null,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info
};

const typeColors = {
  default: 'text-slate-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  info: 'text-blue-400'
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  type = 'default',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  children,
  footer,
  className = ''
}: ModalProps) {
  const Icon = typeIcons[type];
  const iconColor = typeColors[type];

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Overlay */}
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                  onClick={closeOnOverlayClick ? onClose : undefined}
                />
              </Dialog.Overlay>

              {/* Content */}
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${sizeClasses[size]} bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 ${className}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-6 border-b border-slate-700">
                      <div className="flex items-center gap-3">
                        {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
                        <div>
                          {title && (
                            <Dialog.Title className="text-lg font-semibold text-white">
                              {title}
                            </Dialog.Title>
                          )}
                          {description && (
                            <Dialog.Description className="text-sm text-slate-400 mt-1">
                              {description}
                            </Dialog.Description>
                          )}
                        </div>
                      </div>
                      {showCloseButton && (
                        <Dialog.Close asChild>
                          <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-1"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </Dialog.Close>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-6">
                    {children}
                  </div>

                  {/* Footer */}
                  {footer && (
                    <div className="p-6 border-t border-slate-700 bg-slate-800/50">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Confirmation Modal
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: ModalType;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'warning',
  isLoading = false
}: ConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type={type}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`btn ${
              type === 'error' ? 'btn-danger' : 
              type === 'warning' ? 'btn-warning' : 
              'btn-primary'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      }
    >
      <p className="text-slate-300">{message}</p>
    </Modal>
  );
}

// Modal Manager Hook
interface ModalState {
  id: string;
  component: React.ReactNode;
}

export function useModalManager() {
  const [modals, setModals] = useState<ModalState[]>([]);

  const openModal = (id: string, component: React.ReactNode) => {
    setModals(prev => [...prev, { id, component }]);
  };

  const closeModal = (id: string) => {
    setModals(prev => prev.filter(modal => modal.id !== id));
  };

  const closeAllModals = () => {
    setModals([]);
  };

  const ModalContainer = () => (
    <>
      {modals.map(modal => (
        <div key={modal.id}>
          {modal.component}
        </div>
      ))}
    </>
  );

  return {
    openModal,
    closeModal,
    closeAllModals,
    ModalContainer,
    modalCount: modals.length
  };
}

// Drawer Component (Side Modal)
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const drawerSizes = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[32rem]'
};

export function Drawer({
  isOpen,
  onClose,
  title,
  position = 'right',
  size = 'md',
  children,
  footer
}: DrawerProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Overlay */}
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                  onClick={onClose}
                />
              </Dialog.Overlay>

              {/* Content */}
              <Dialog.Content asChild>
                <motion.div
                  initial={{ 
                    x: position === 'right' ? '100%' : '-100%',
                    opacity: 0 
                  }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ 
                    x: position === 'right' ? '100%' : '-100%',
                    opacity: 0 
                  }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className={`fixed top-0 ${position === 'right' ? 'right-0' : 'left-0'} h-full ${drawerSizes[size]} bg-slate-900 border-${position === 'right' ? 'l' : 'r'} border-slate-700 shadow-2xl z-50 flex flex-col`}
                >
                  {/* Header */}
                  {title && (
                    <div className="flex items-center justify-between p-6 border-b border-slate-700">
                      <Dialog.Title className="text-lg font-semibold text-white">
                        {title}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button
                          onClick={onClose}
                          className="text-slate-400 hover:text-white transition-colors p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </Dialog.Close>
                    </div>
                  )}

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {children}
                  </div>

                  {/* Footer */}
                  {footer && (
                    <div className="p-6 border-t border-slate-700 bg-slate-800/50">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}