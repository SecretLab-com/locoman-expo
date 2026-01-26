import React, { createContext, useContext } from 'react';
import { YStack, XStack, Text, styled } from 'tamagui';
import { Label } from './Label';

// Form Field Context
interface FormFieldContextType {
  name: string;
  error?: string;
  required?: boolean;
}

const FormFieldContext = createContext<FormFieldContextType | undefined>(undefined);

// Form
interface FormProps {
  children: React.ReactNode;
  onSubmit?: () => void;
}

export function Form({ children, onSubmit }: FormProps) {
  return (
    <YStack gap="$4">
      {children}
    </YStack>
  );
}

// Form Field
interface FormFieldProps {
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ name, error, required, children }: FormFieldProps) {
  return (
    <FormFieldContext.Provider value={{ name, error, required }}>
      <YStack gap="$2">
        {children}
      </YStack>
    </FormFieldContext.Provider>
  );
}

// Form Label
interface FormLabelProps {
  children: React.ReactNode;
}

export function FormLabel({ children }: FormLabelProps) {
  const context = useContext(FormFieldContext);
  
  return (
    <Label required={context?.required} error={!!context?.error}>
      {children}
    </Label>
  );
}

// Form Control - wrapper for input elements
interface FormControlProps {
  children: React.ReactNode;
}

export function FormControl({ children }: FormControlProps) {
  return <>{children}</>;
}

// Form Description
interface FormDescriptionProps {
  children: React.ReactNode;
}

export function FormDescription({ children }: FormDescriptionProps) {
  return (
    <Text fontSize="$2" color="$gray10">
      {children}
    </Text>
  );
}

// Form Message (error message)
interface FormMessageProps {
  children?: React.ReactNode;
}

export function FormMessage({ children }: FormMessageProps) {
  const context = useContext(FormFieldContext);
  const message = children || context?.error;
  
  if (!message) return null;
  
  return (
    <Text fontSize="$2" color="$red10">
      {message}
    </Text>
  );
}

// Form Item - combines label, control, description, and message
interface FormItemProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormItem({ label, description, error, required, children }: FormItemProps) {
  return (
    <YStack gap="$2">
      {label && (
        <Label required={required} error={!!error}>
          {label}
        </Label>
      )}
      {children}
      {description && !error && (
        <Text fontSize="$2" color="$gray10">
          {description}
        </Text>
      )}
      {error && (
        <Text fontSize="$2" color="$red10">
          {error}
        </Text>
      )}
    </YStack>
  );
}

// useFormField hook
export function useFormField() {
  const context = useContext(FormFieldContext);
  return context;
}

export default Form;
