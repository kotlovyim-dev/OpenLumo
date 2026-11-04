import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'field-sizing-content min-h-10 w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted read-only:bg-surface aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}
