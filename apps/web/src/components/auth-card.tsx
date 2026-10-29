import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

/** The layout of the sign-in, sign-up and password pages. */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6 pt-16">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
      {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
    </main>
  );
}

/** A labelled input. */
export function Field({ label, ...props }: { label: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

/** A labelled password input, with a button that shows and hides the password. */
export function PasswordField({
  label,
  className,
  ...props
}: { label: string } & Omit<ComponentProps<typeof Input>, "type">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={cn("pr-9", className)}
          {...props}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          {/* No transition and no press offset: the icon just swaps. */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="transition-none active:not-aria-[haspopup]:translate-y-0"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            aria-controls={id}
            disabled={props.disabled}
            onClick={() => setVisible((shown) => !shown)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A form's error, or nothing. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}
