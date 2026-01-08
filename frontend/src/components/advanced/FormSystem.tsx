import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle,
  Info,
  Upload,
  X
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import * as Slider from '@radix-ui/react-slider';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';

// Form field types
export type FieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'number' 
  | 'textarea' 
  | 'select' 
  | 'multiselect'
  | 'switch' 
  | 'slider' 
  | 'checkbox' 
  | 'radio' 
  | 'file'
  | 'date'
  | 'time';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string; // for file inputs
  multiple?: boolean;
  validation?: z.ZodType<any>;
}

export interface FormConfig {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  onSubmit: (data: any) => Promise<void> | void;
  schema?: z.ZodSchema;
}

interface FormSystemProps {
  config: FormConfig;
  initialValues?: Record<string, any>;
  isLoading?: boolean;
}

export function FormSystem({ config, initialValues = {}, isLoading = false }: FormSystemProps) {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset
  } = useForm({
    resolver: config.schema ? zodResolver(config.schema as any) : undefined,
    defaultValues: initialValues,
    mode: 'onChange'
  });

  const onSubmit = async (data: any) => {
    try {
      await config.onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const renderField = (field: FormField) => {
    const error = errors[field.name];
    const hasError = !!error;

    return (
      <motion.div
        key={field.name}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <label className="block text-sm font-medium text-slate-300">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>

        <Controller
          name={field.name}
          control={control}
          render={({ field: { onChange, value, ...fieldProps } }) => {
            const renderField = () => {
              switch (field.type) {
              case 'text':
              case 'email':
              case 'number':
                return (
                  <input
                    {...fieldProps}
                    type={field.type}
                    value={value || ''}
                    onChange={onChange}
                    placeholder={field.placeholder}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      hasError ? 'border-red-500' : 'border-slate-700'
                    }`}
                  />
                );

              case 'password':
                return (
                  <div className="relative">
                    <input
                      {...fieldProps}
                      type={showPasswords[field.name] ? 'text' : 'password'}
                      value={value || ''}
                      onChange={onChange}
                      placeholder={field.placeholder}
                      className={`w-full px-3 py-2 pr-10 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        hasError ? 'border-red-500' : 'border-slate-700'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.name)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPasswords[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                );

              case 'textarea':
                return (
                  <textarea
                    {...fieldProps}
                    value={value || ''}
                    onChange={onChange}
                    placeholder={field.placeholder}
                    rows={4}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-vertical ${
                      hasError ? 'border-red-500' : 'border-slate-700'
                    }`}
                  />
                );

              case 'select':
                return (
                  <Select.Root value={value} onValueChange={onChange}>
                    <Select.Trigger className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      hasError ? 'border-red-500' : 'border-slate-700'
                    }`}>
                      <Select.Value placeholder={field.placeholder} />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                        <Select.Viewport className="p-1">
                          {field.options?.map((option) => (
                            <Select.Item
                              key={option.value}
                              value={option.value}
                              className="px-3 py-2 text-white hover:bg-slate-700 rounded cursor-pointer"
                            >
                              <Select.ItemText>{option.label}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                );

              case 'switch':
                return (
                  <Switch.Root
                    checked={value}
                    onCheckedChange={onChange}
                    className="w-11 h-6 bg-slate-700 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors"
                  >
                    <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                  </Switch.Root>
                );

              case 'slider':
                return (
                  <div className="space-y-2">
                    <Slider.Root
                      value={[value || field.min || 0]}
                      onValueChange={(values) => onChange(values[0])}
                      max={field.max || 100}
                      min={field.min || 0}
                      step={field.step || 1}
                      className="relative flex items-center select-none touch-none w-full h-5"
                    >
                      <Slider.Track className="bg-slate-700 relative grow rounded-full h-1">
                        <Slider.Range className="absolute bg-blue-600 rounded-full h-full" />
                      </Slider.Track>
                      <Slider.Thumb className="block w-5 h-5 bg-white border-2 border-blue-600 rounded-full hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </Slider.Root>
                    <div className="text-sm text-slate-400">{value || field.min || 0}</div>
                  </div>
                );

              case 'checkbox':
                return (
                  <div className="flex items-center space-x-2">
                    <Checkbox.Root
                      checked={value}
                      onCheckedChange={onChange}
                      className="flex h-4 w-4 items-center justify-center rounded border border-slate-700 bg-slate-800 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    >
                      <Checkbox.Indicator>
                        <CheckCircle className="h-3 w-3 text-white" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <label className="text-sm text-slate-300">{field.label}</label>
                  </div>
                );

              case 'radio':
                return (
                  <RadioGroup.Root value={value} onValueChange={onChange} className="space-y-2">
                    {field.options?.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroup.Item
                          value={option.value}
                          className="h-4 w-4 rounded-full border border-slate-700 bg-slate-800 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        >
                          <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:w-2 after:h-2 after:rounded-full after:bg-white" />
                        </RadioGroup.Item>
                        <label className="text-sm text-slate-300">{option.label}</label>
                      </div>
                    ))}
                  </RadioGroup.Root>
                );

              case 'file':
                return (
                  <div className="space-y-2">
                    <input
                      {...fieldProps}
                      type="file"
                      onChange={(e) => onChange(e.target.files)}
                      accept={field.accept}
                      multiple={field.multiple}
                      className="hidden"
                      id={`file-${field.name}`}
                    />
                    <label
                      htmlFor={`file-${field.name}`}
                      className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors ${
                        hasError ? 'border-red-500' : 'border-slate-700'
                      }`}
                    >
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm text-slate-400">
                          {field.placeholder || 'Click to upload files'}
                        </p>
                      </div>
                    </label>
                    {value && value.length > 0 && (
                      <div className="space-y-1">
                        {Array.from(value as FileList).map((file: File, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                            <span className="text-sm text-slate-300">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = Array.from(value).filter((_, i) => i !== index);
                                onChange(newFiles.length > 0 ? newFiles : null);
                              }}
                              className="text-slate-400 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );

              default:
                return <div>Unsupported field type</div>;
            }
            };
            
            return renderField();
          }}
        />

        {field.description && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {field.description}
          </p>
        )}

        <AnimatePresence>
          {hasError && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {(error as any)?.message}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{config.title}</h2>
        {config.description && (
          <p className="text-slate-400">{config.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {config.fields.map(renderField)}

        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-700">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-ghost"
            disabled={isSubmitting || isLoading}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading || !isValid}
            className="btn btn-primary"
          >
            {isSubmitting || isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              config.submitLabel || 'Submit'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}