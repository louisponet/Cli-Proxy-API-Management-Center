import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';

export interface QuotaProviderIconProps {
  provider: string;
  resolvedTheme: ResolvedTheme;
  className?: string;
  imageClassName?: string;
}

/** Provider logo, or its initial when no icon is bundled. Decorative: the name sits beside it. */
export function QuotaProviderIcon({
  provider,
  resolvedTheme,
  className,
  imageClassName,
}: QuotaProviderIconProps) {
  const { t } = useTranslation();
  const iconSrc = getAuthFileIcon(provider, resolvedTheme);
  return (
    <span
      className={className}
      aria-hidden="true"
      style={
        isThemeSurfaceIconProvider(provider)
          ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
          : undefined
      }
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className={imageClassName} />
      ) : (
        getTypeLabel(t, provider).slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
