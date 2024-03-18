import { App } from "./system";

const css = `
  html {
    min-height: 100vh;
    background: var(--background);
    box-sizing: border-box;
    font-family: var(--font-family);
  }
  
  *,
  *::before,
  *::after {
    box-sizing: inherit;
    font-family: inherit;
  }
  
  #root {
    min-height: 100vh;
  }
  
  #login-root {
    display: flex;
    align-items: center;
    min-height: 100vh;
    flex-direction: column;
    padding: 6rem 1.5rem 3rem 1.5rem;
  
    @media (min-width: 1024px) {
      padding-top: 9rem;
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }
  
  .header {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 24rem;
  }
  
  .logo {
    margin-left: auto;
    margin-right: auto;
    height: var(--logo-height);
    width: auto;
  }
  
  .login-text {
    margin-top: 1.25rem;
    text-align: center;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 2.25rem;
    letter-spacing: -0.025em;
    color: var(--login-text-color);
  }
  
  #login-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-top: 1rem;
    width: 100%;
    max-width: 32rem;
  }
  
  .email-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.5rem;
    color: var(--email-label-color);
    padding-bottom: 0.5rem;
  }
  
  #login-email {
    display: block;
    width: 100%;
    max-width: 32rem;
    border-radius: 0.5rem;
    border: 0;
    padding: 0.5rem;
    color: var(--email-input-color);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2),
      inset 0 1px 2px 0 rgba(156, 163, 175, 0.5);
    appearance: none;
    font-size: 1.125rem;
    line-height: 1.5;
  
    &:focus {
      outline: 2px solid var(--email-focus-outline);
    }
  }
  
  #login-button {
    appearance: none;
    display: inline-flex;
    width: 100%;
    justify-content: center;
    border-radius: 0.5rem;
    background-color: var(--submit-button-background);
    padding: 0.5rem 0.75rem;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.5rem;
    color: var(--submit-button-color);
    outline-offset: 2px;
    outline: none;
    border: none;
    font-family: inherit;
  
    &:hover {
      background-color: var(--submit-button-hover-background);
    }
  
    &:focus {
      outline: 2px solid var(--submit-button-focus-outline);
    }
  }
  
  #login-error {
    background-color: var(--error-background);
    color: var(--error-color);
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    white-space: pre-wrap;
  }
  
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  
  .spinner-svg {
    color: var(--spinner-text-color);
    fill: var(--spinner-fill-color);
    animation: spin 1s linear infinite;
  }
  
  .spinner-login-svg {
    width: 1.5rem;
    height: 1.5rem;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  .register-heading {
    margin-top: 1.25rem;
    text-align: center;
    font-size: 1.875rem;
    font-weight: 700;
    line-height: 2.25rem;
    letter-spacing: -0.025em;
    color: var(--register-heading-color);
  }
  
  .register-text {
    font-size: 1rem;
    font-weight: 500;
    color: var(--register-text-color);
    margin-left: auto;
    margin-right: auto;
    margin-top: 1rem;
    text-align: center;
  }
  
  .register-body {
    margin-top: 2.5rem;
  
    @media (min-width: 640px) {
      & {
        margin-left: auto;
        margin-right: auto;
        width: 100%;
        max-width: 32rem;
      }
    }
  }
  
  .code-inputs {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
    gap: 0.5rem;
    @media (min-width: 768px) {
      gap: 0.75rem;
    }
  }
  
  .code-input-wrapper {
    width: 2.125rem;
    height: 2.75rem;
  
    @media (min-width: 768px) {
      width: 3rem;
      height: 3.5rem;
    }
  }
  
  .code-input {
    width: 100%;
    height: 100%;
    text-align: center;
    padding: 0.5rem;
    border-radius: 0.75rem;
    border: 1px solid var(--code-input-border-color);
    font-size: 1rem;
    background-color: var(--code-input-background);
  
    &:focus {
      background-color: var(--code-input-focus-background);
      outline: 2px solid var(--code-input-focus-outline);
    }

    @media (min-width: 768px) {
      font-size: 1.125rem;
    }
  }
  
  .register-loading {
    margin-top: 2rem;
    display: flex;
    justify-content: center;
  }
  
  .spinner-register-svg {
    width: 2.5rem;
    height: 2.5rem;
  }
  
  #register-error {
    background-color: var(--error-background);
    color: var(--error-color);
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    white-space: pre-wrap;
    margin-top: 1rem;
  }
`;

export interface LoginCssVars {
  "--background"?: string;
  "--font-family"?: string;
  "--logo-height"?: string;
  "--login-text-color"?: string;
  "--email-label-color"?: string;
  "--email-input-color"?: string;
  "--email-focus-outline"?: string;
  "--submit-button-background"?: string;
  "--submit-button-hover-background"?: string;
  "--submit-button-focus-outline"?: string;
  "--submit-button-color"?: string;
  "--error-background"?: string;
  "--error-color"?: string;
  "--spinner-text-color"?: string;
  "--spinner-fill-color"?: string;
  "--register-heading-color"?: string;
  "--register-text-color"?: string;
  "--code-input-border-color"?: string;
  "--code-input-background"?: string;
  "--code-input-focus-background"?: string;
  "--code-input-focus-outline"?: string;
}

const defaultVars: LoginCssVars = {
  "--background": "white",
  "--font-family": `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
  "--logo-height": "5rem",
  "--login-text-color": "#4b5563",

  "--email-label-color": "#4b5563",
  "--email-input-color": "#4b5563",
  "--email-focus-outline": "rgba(37, 37, 37, 0.6)",

  "--submit-button-background": "#000000",
  "--submit-button-hover-background": "#1a1a1a",
  "--submit-button-focus-outline": "#1a1a1a",
  "--submit-button-color": "#fafafa",

  "--error-background": "#dc2626",
  "--error-color": "#f9fafb",

  "--spinner-text-color": "#1a1a1a",
  "--spinner-fill-color": "#ffffff",

  "--register-heading-color": "#1f2937",
  "--register-text-color": "#4b5563",

  "--code-input-border-color": "#d1d5db",
  "--code-input-background": "#ffffff",
  "--code-input-focus-background": "#f3f4f6",
  "--code-input-focus-outline": "rgba(37, 37, 37, 0.6)",
};

interface Logo {
  src: string;
  alt: string;
}

export interface LoginOptions {
  vars?: LoginCssVars;
  logo?: Logo;
  favicon32x32?: string;
  favicon16x16?: string;
  signInText?: string;
  priorCss?: string;
  title?: string;
}

function createLoginHtml(opts: LoginOptions, app: App): string {
  const logo = opts.logo ?? {
    src: "/global_assets/logo/main.png",
    alt: "Yolm logo",
  };
  function wrapInLogin(body: string) {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${opts.title ?? app.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link
      rel="icon"
      type="image/png"
      sizes="32x32"
      href="${opts.favicon32x32 ?? "/global_assets/logo/favicon-32x32.png"}"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="16x16"
      href="${opts.favicon16x16 ?? "/global_assets/logo/favicon-16x16.png"}"
    />
    <link rel="stylesheet" href="/login.css" />
  </head>

  <body><div id="root">${body}</div></body>
</html>`;
  }
  return wrapInLogin(`
<div id="login-root">
  <div class="header">
    <img class="logo" src="${logo.src}" alt="${logo.alt}" />
    <h2 class="login-text">${
      opts.signInText ?? "Sign in to your yolm account"
    }</h2>
  </div>

  <form id="login-form">
    <div>
      <label for="login-email" class="email-label">Email address</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autocomplete="email"
        required
        autofocus
      />
    </div>

    <button type="submit" id="login-button">Sign in</button>

    <div hidden id="login-error">Error</div>
  </form>
</div>

<template id="login-spinner">
  <div role="status">
    <svg
      aria-hidden="true"
      class="spinner-svg spinner-login-svg"
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
    <span class="sr-only">Loading...</span>
  </div>
</template>

<template id="register-template">
  <div class="header">
    <img class="logo" src="${logo.src}" alt="${logo.alt}" />
    <h2 class="register-heading">Enter code</h2>
    <p class="register-text">
      We have sent a code to your email<br />
      Enter it below to sign in
    </p>
  </div>

  <div class="register-body">
    <div class="code-inputs">
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-0"
          inputmode="numeric"
        />
      </div>
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-1"
          inputmode="numeric"
        />
      </div>
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-2"
          inputmode="numeric"
        />
      </div>
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-3"
          inputmode="numeric"
        />
      </div>

      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-4"
          inputmode="numeric"
        />
      </div>
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-5"
          inputmode="numeric"
        />
      </div>
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-6"
          inputmode="numeric"
        />
      </div>
      <div class="code-input-wrapper">
        <input
          class="code-input"
          type="text"
          id="code-input-7"
          inputmode="numeric"
        />
      </div>
    </div>

    <div hidden id="register-loading">
      <div role="status" class="register-loading">
        <svg
          aria-hidden="true"
          class="spinner-svg spinner-register-svg"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
        <span class="sr-only">Loading...</span>
      </div>
    </div>

    <div hidden id="register-error">Error</div>
  </div>
</template>

<script src="/global_assets/login.js"></script>
`);
}

export function createLogin(
  opts: LoginOptions,
  app: App,
): {
  css: string;
  html: string;
} {
  const mergedVars = { ...defaultVars, ...opts.vars };
  const varsString =
    Object.entries(mergedVars).reduce((acc, [key, value]) => {
      return value ? `${acc}    ${key}: ${value};\n` : acc;
    }, ":root {\n") + "}";
  return {
    css: (opts.priorCss ?? "") + varsString + css,
    html: createLoginHtml(opts, app),
  };
}
