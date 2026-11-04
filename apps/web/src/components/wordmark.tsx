import { cn } from '@/lib/utils';

export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/logo/openlumo-wordmark.svg"
      alt="OpenLumo"
      width={470}
      height={120}
      className={cn('h-8 w-auto', className)}
    />
  );
}
