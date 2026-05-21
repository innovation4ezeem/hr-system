import React, { useRef, useEffect } from 'react';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import Icon from '@/components/ui/AppIcon';

export interface InlineEditableFieldProps {
  initialValue: string;
  onSave: (value: string) => void | Promise<void>;
  type?: 'text' | 'email' | 'number' | 'textarea' | 'date' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  textClassName?: string;
  inputClassName?: string;
  validate?: (value: string) => string | null;
  minRows?: number;
  readOnly?: boolean;
  style?: React.CSSProperties;
}

export default function InlineEditableField({
  initialValue,
  onSave,
  type = 'text',
  placeholder = 'Empty',
  className = '',
  textClassName = '',
  inputClassName = '',
  validate,
  minRows = 2,
  readOnly = false,
  options = [],
  style
}: InlineEditableFieldProps) {
  const {
    isEditing,
    setIsEditing,
    value,
    setValue,
    isSaving,
    error,
    handleSave,
    cancel
  } = useInlineEdit({ initialValue, onSave, validate });
  
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (type === 'textarea' && e.shiftKey) return; // Allow newlines with Shift+Enter in textarea
      e.preventDefault();
      handleSave(value);
    } else if (e.key === 'Escape') {
      cancel();
    }
  };

  const onBlur = () => {
    // Only save if it's not currently saving to avoid double-saves
    if (!isSaving) {
      handleSave(value);
    }
  };

  if (isEditing) {
    const commonProps = {
      value,
      onChange: (e: React.ChangeEvent<any>) => setValue(e.target.value),
      onKeyDown,
      onBlur,
      disabled: isSaving,
      placeholder,
      className: `input-base text-sm border-blue-500 focus:ring-blue-500 w-full disabled:opacity-70 ${inputClassName} ${error ? 'border-red-500' : ''}`,
    };

    return (
      <div className={`relative flex items-center ${className}`}>
        {type === 'textarea' ? (
          <textarea
            {...commonProps}
            ref={inputRef}
            rows={Math.max(minRows, (value.match(/\n/g) || []).length + 1)}
            className={`${commonProps.className} resize-none py-2`}
          />
        ) : type === 'select' ? (
          <select
            {...commonProps}
            ref={inputRef}
            className={`${commonProps.className} h-9 cursor-pointer`}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            {...commonProps}
            type={type}
            ref={inputRef}
            className={`${commonProps.className} h-9 ${type === 'date' ? 'cursor-pointer' : ''}`}
            onClick={type === 'date' ? (e) => (e.currentTarget as any).showPicker?.() : undefined}
          />
        )}
        {isSaving && (
          <div className="absolute right-3 top-2.5">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center rounded px-2 -mx-2 py-1.5 transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'} ${className}`}
      onClick={() => !readOnly && setIsEditing(true)}
      title={readOnly ? undefined : "Click to edit"}
    >
      <span 
        className={`${textClassName} ${!value ? 'text-slate-500 italic' : ''} whitespace-pre-wrap break-words w-full`} 
        style={{ color: !value ? undefined : 'rgb(var(--text-primary))', ...style }}
      >
        {value || placeholder}
      </span>
      {!readOnly && (
        <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white shadow-lg border border-black/5 dark:border-white/5">
          <Icon name="PencilSquareIcon" size={14} />
        </div>
      )}
    </div>
  );
}
