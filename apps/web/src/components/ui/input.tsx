import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-control border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted',
        className,
      )}
      {...props}
    />
  );
}
