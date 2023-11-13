import { app } from "../app";
import { StyleObject } from "../styleTypes";
import { TypographyKeys } from "../theme";
import { createStyles, cssVar } from "../styleUtils";
import { mergeEls, SingleElementComponentOpts } from "./utils";
import { lazy } from "../utils/memoize";

export type SkeletonVariant = "rectangular" | "circular" | "text";
export type Animation = "pulse" | "wave";
type Level = TypographyKeys | "inherit";

export interface SkeletonOpts extends SingleElementComponentOpts {
  variant?: SkeletonVariant;
  animation?: Animation;
  level?: Level;
}

const pulseAnimation = lazy(() =>
  app.ui.registerKeyframes({
    "0%": {
      opacity: 1,
    },
    "50%": {
      opacity: 0.8,
      background: "var(--unstable-pulse-bg)",
    },
    "100%": {
      opacity: 1,
    },
  })
);

const waveAnimation = lazy(() =>
  app.ui.registerKeyframes({
    "0%": {
      transform: "translateX(-100%)",
    },
    "50%": {
      transform: "translateX(100%)",
    },
    "100%": {
      transform: "translateX(100%)",
    },
  })
);

const styles = createStyles({
  skeleton: (variant: SkeletonVariant, animation: Animation, level: Level) => {
    const theme = app.ui.theme;
    const styleBase: StyleObject = {
      display: "block",
      position: "relative",
      "--unstable-pseudo-z-index": 9,
      "--unstable-pulse-bg": cssVar(`palette-background-level1`),
      overflow: "hidden",
      cursor: "default",
      color: "transparent",
      "& *": {
        visibility: "hidden",
      },
      "&::before": {
        display: "block",
        content: '" "',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: "var(--unstable-pseudo-z-index)",
        borderRadius: "inherit",
      },
      dark: {
        "--unstable-wave-bg": "rgba(255 255 255 / 0.1)",
      },
    };
    let variantStyles: StyleObject = {};
    switch (variant) {
      case "rectangular":
        variantStyles = {
          borderRadius: "min(0.15em, 6px)",
          height: "auto",
          width: "100%",
          "&::before": {
            position: "absolute",
          },
        };
        if (!animation) {
          variantStyles.backgroundColor = cssVar(`palette-background-level3`);
        }
        if (level !== "inherit") {
          Object.assign(variantStyles, theme.typography[level]);
        }
        break;
      case "circular":
        variantStyles = {
          borderRadius: "50%",
          width: "100%",
          height: "100%",
          "&::before": {
            position: "absolute",
          },
        };
        if (!animation) {
          variantStyles.backgroundColor = cssVar(`palette-background-level3`);
        }
        if (level !== "inherit") {
          Object.assign(variantStyles, theme.typography[level]);
        }
        break;
      case "text":
        variantStyles = {
          borderRadius: "min(0.15em, 6px)",
          background: "transparent",
          width: "100%",
          height: "100%",
          ...(level !== "inherit" && {
            ...theme.typography[level],
            paddingBlockStart: `calc((${
              theme.typography[level]?.lineHeight || 1
            } - 1) * 0.56em)`,
            paddingBlockEnd: `calc((${
              theme.typography[level]?.lineHeight || 1
            } - 1) * 0.44em)`,
            "&::before": {
              height: "1em",
              ...theme.typography[level],
              ...(animation === "wave" && {
                backgroundColor: cssVar(`palette-background-level3`),
              }),
              ...(!animation
                ? {
                    backgroundColor: cssVar(`palette-background-level3`),
                  }
                : {}),
            },
            "&::after": {
              height: "1em",
              top: `calc((${
                theme.typography[level]?.lineHeight || 1
              } - 1) * 0.56em)`,
              ...theme.typography[level],
            },
          }),
        };
        break;
    }
    let animationStyles: StyleObject | undefined;
    if (animation === "pulse") {
      animationStyles = {
        "&::before": {
          animation: `${pulseAnimation()} 2s ease-in-out 0.5s infinite`,
          background: cssVar(`palette-background-level3`),
        },
      };
    } else if (animation === "wave") {
      animationStyles = {
        backgroundColor: cssVar(`palette-background-level3`),
        "-webkit-mask-image": "-webkit-radial-gradient(white, black)",
        "&::after": {
          content: "' '",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: "var(--unstable_pseudo-z-index)",
          animation: `${waveAnimation()} 1.6s linear 0.5s infinite`,
          background: `linear-gradient(
          90deg,
          transparent,
          var(--unstable_wave-bg, rgba(0 0 0 / 0.08)),
          transparent
        )`,
          transform: "translateX(-100%)",
        },
      };
    }
    return [styleBase, variantStyles, animationStyles];
  },
});

export function skeleton(opts: SkeletonOpts) {
  return mergeEls(
    {
      tag: "div",
      styles: styles.skeleton(
        opts.variant ?? "rectangular",
        opts.animation ?? "pulse",
        opts.level ?? "inherit"
      ),
    },
    opts
  );
}
