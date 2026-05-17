import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface UseInlineEditProps<T> {
  initialValue: T;
  onSave: (newValue: T) => void | Promise<void>;
  validate?: (value: T) => string | null;
}

export function useInlineEdit<T>({ initialValue, onSave, validate }: UseInlineEditProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<T>(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = async (newValue: T) => {
    if (newValue === initialValue) {
      setIsEditing(false);
      return;
    }

    if (validate) {
      const validationError = validate(newValue);
      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        return;
      }
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave(newValue);
      toast.success('Changes saved', { duration: 2000, position: 'top-center' });
      setIsEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
      toast.error(msg, { position: 'top-center' });
      // Keep edit mode open so the user can fix the input or try again
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => {
    setValue(initialValue);
    setIsEditing(false);
    setError(null);
  };

  return {
    isEditing,
    setIsEditing,
    value,
    setValue,
    isSaving,
    error,
    handleSave,
    cancel
  };
}
