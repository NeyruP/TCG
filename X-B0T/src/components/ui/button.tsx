import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[opacity,transform,background-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96] select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-fg hover:opacity-90",
        secondary:
          "bg-surface-2 text-fg border border-border hover:border-border-strong",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        danger: "bg-danger text-fg hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-[10px]",
        md: "h-11 px-4 text-sm rounded-[12px]",
        lg: "h-12 px-5 text-base rounded-[14px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
>(({ className, variant, size, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
));
Button.displayName = "Button";
