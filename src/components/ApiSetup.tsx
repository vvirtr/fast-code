import React, { useState } from 'react'
import { Box, Text } from '../ink.js'
import { updateSettingsForSource } from '../utils/settings/settings.js'
import { Select } from './CustomSelect/select.js'

type Provider = 'openrouter' | 'anthropic' | 'custom'

type Props = {
  onDone(): void
}

export function ApiSetup({ onDone }: Props): React.ReactNode {
  const [step, setStep] = useState<'provider' | 'custom-url' | 'api-key'>(
    'provider',
  )
  const [provider, setProvider] = useState<Provider>('openrouter')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')

  function handleProviderSelect(value: string) {
    const selected = value as Provider
    setProvider(selected)
    if (selected === 'anthropic') {
      setBaseUrl('')
      setStep('api-key')
    } else if (selected === 'openrouter') {
      setBaseUrl('https://openrouter.ai/api/v1')
      setStep('api-key')
    } else {
      // custom — need to ask for URL first
      setStep('custom-url')
    }
  }

  function handleCustomUrlSubmit() {
    if (baseUrl.trim()) {
      setStep('api-key')
    }
  }

  function handleApiKeySubmit() {
    if (!apiKey.trim()) {
      return
    }

    const envUpdate: Record<string, string> = {
      ANTHROPIC_API_KEY: apiKey.trim(),
    }

    if (provider === 'openrouter' || provider === 'custom') {
      envUpdate.ANTHROPIC_BASE_URL = baseUrl
    }

    updateSettingsForSource('userSettings', {
      env: envUpdate,
    })

    // Also set in current process so the key is available immediately
    process.env.ANTHROPIC_API_KEY = apiKey.trim()
    if (envUpdate.ANTHROPIC_BASE_URL) {
      process.env.ANTHROPIC_BASE_URL = envUpdate.ANTHROPIC_BASE_URL
    }

    onDone()
  }

  const providerOptions = [
    {
      label: 'OpenRouter',
      value: 'openrouter' as const,
      description: 'https://openrouter.ai/api/v1',
    },
    {
      label: 'Anthropic (direct)',
      value: 'anthropic' as const,
      description: 'Default Anthropic API',
    },
    {
      label: 'Custom endpoint',
      value: 'custom' as const,
      description: 'Enter your own API base URL',
    },
  ]

  if (step === 'provider') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>API Configuration</Text>
        <Text>Select your API provider:</Text>
        <Select
          options={providerOptions}
          onChange={handleProviderSelect}
          onCancel={() => onDone()}
        />
        <Text dimColor>Enter to select</Text>
      </Box>
    )
  }

  if (step === 'custom-url') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>API Configuration</Text>
        <Text>Enter your custom API base URL:</Text>
        <Select
          options={[
            {
              label: 'Base URL',
              value: 'url',
              type: 'input' as const,
              onChange: (value: string) => setBaseUrl(value),
              placeholder: 'https://api.example.com/v1',
              initialValue: baseUrl,
            },
          ]}
          onChange={handleCustomUrlSubmit}
          onCancel={() => setStep('provider')}
        />
        <Text dimColor>Enter to confirm · Esc to go back</Text>
      </Box>
    )
  }

  // step === 'api-key'
  const providerLabel =
    provider === 'openrouter'
      ? 'OpenRouter'
      : provider === 'anthropic'
        ? 'Anthropic'
        : `Custom (${baseUrl})`

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>API Configuration</Text>
      <Text>
        Provider: <Text color="green">{providerLabel}</Text>
      </Text>
      <Text>Enter your API key:</Text>
      <Select
        options={[
          {
            label: 'API Key',
            value: 'key',
            type: 'input' as const,
            onChange: (value: string) => setApiKey(value),
            placeholder: 'sk-...',
            initialValue: apiKey,
          },
        ]}
        onChange={handleApiKeySubmit}
        onCancel={() => setStep('provider')}
      />
      <Text dimColor>Enter to confirm · Esc to go back</Text>
    </Box>
  )
}
