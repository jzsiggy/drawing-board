// Button looks, for <button> and <Link> alike. Square, flat, full width
// unless the caller says otherwise.
const BASE =
  "flex items-center justify-center px-5 text-center font-medium transition disabled:cursor-not-allowed aria-disabled:pointer-events-none";

const VARIANTS = {
  primary: "min-h-13 bg-primary text-base text-white hover:bg-primary-dark disabled:bg-sunken disabled:text-faint",
  secondary: "min-h-12 border-[1.5px] border-ink bg-card text-[15px] text-ink hover:bg-sunken disabled:border-line disabled:text-faint",
  quiet: "min-h-11 text-[15px] text-ink underline underline-offset-4 disabled:text-faint",
  inverse: "min-h-13 bg-paper text-base text-ink hover:bg-sunken",
};

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClass(variant: ButtonVariant, extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}
