import { useState, type FormEvent, useEffect, useRef } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { PageHeader, Panel, StatusChip, Button } from '../ui/kit'

interface Linen {
  id: string
  linen_id: string
  category: string
  item_type: string
  client_name: string
  status: string
  condition: string
  location?: string | null
  wash_count?: number
}

/** The statuses a scan may move a piece to, exactly as the API defines them. */
const ACTIONS: Array<{ action: string; label: string }> = [
  { action: 'collect', label: 'Collect' },
  { action: 'receive', label: 'Receive' },
  { action: 'start_wash', label: 'Start wash' },
  { action: 'complete_wash', label: 'Complete wash' },
  { action: 'press', label: 'Press' },
  { action: 'ready', label: 'Ready' },
  { action: 'deliver', label: 'Deliver' },
  { action: 'mark_missing', label: 'Missing' },
  { action: 'mark_damaged', label: 'Damaged' },
]

export function ScanPage() {
  const [code, setCode] = useState('')
  const [linen, setLinen] = useState<Linen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  
  // Bluetooth state
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [bluetoothConnected, setBluetoothConnected] = useState(false)
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null)
  const [bluetoothError, setBluetoothError] = useState<string | null>(null)
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const scanBufferRef = useRef<string>('')

  // Check for Bluetooth support on mount
  useEffect(() => {
    setBluetoothSupported('bluetooth' in navigator)
  }, [])

  // Cleanup Bluetooth connection on unmount
  useEffect(() => {
    return () => {
      if (bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect()
      }
    }
  }, [bluetoothDevice])

  async function connectBluetooth() {
    setBluetoothError(null)
    
    try {
      // Request Bluetooth device - most scanners appear as HID devices
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['00001812-0000-1000-8000-00805f9b34fb'] }, // HID service
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }, // Common scanner service
        ],
        optionalServices: ['00001812-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb'],
        acceptAllDevices: true,
      })

      setBluetoothDevice(device)
      
      // Connect to device
      const server = await device.gatt?.connect()
      if (!server) throw new Error('Failed to connect to GATT server')

      // Try to get services - scanners vary in implementation
      const services = await server.getServices()
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics()
          
          for (const characteristic of characteristics) {
            // Try to subscribe to notifications/indications
            try {
              await characteristic.startNotifications()
              characteristic.addEventListener('characteristicvaluechanged', handleBluetoothData)
              characteristicRef.current = characteristic
              setBluetoothConnected(true)
              setNotice(`Connected to ${device.name || 'Bluetooth Scanner'}`)
              console.log('Bluetooth connected to:', device.name)
              return
            } catch (e) {
              // Continue to next characteristic
              continue
            }
          }
        } catch (e) {
          // Continue to next service
          continue
        }
      }
      
      throw new Error('Could not find suitable characteristic for data reception')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Bluetooth device'
      setBluetoothError(errorMessage)
      setBluetoothConnected(false)
      console.error('Bluetooth connection error:', errorMessage)
    }
  }

  function handleBluetoothData(event: Event) {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    
    if (value) {
      // Convert received data to string
      const decoder = new TextDecoder()
      const data = decoder.decode(value)
      
      // Some scanners send data one character at a time, others send complete strings
      scanBufferRef.current += data
      
      // Check if we have a complete scan (common delimiters: newline, carriage return, or sufficient length)
      if (data.includes('\n') || data.includes('\r') || scanBufferRef.current.length >= 10) {
        const completeCode = scanBufferRef.current.trim().replace(/[\n\r]/g, '')
        scanBufferRef.current = ''
        
        if (completeCode) {
          setCode(completeCode)
          // Auto-submit after a short delay to allow UI to update
          setTimeout(() => {
            const form = document.querySelector('form') as HTMLFormElement
            if (form) form.requestSubmit()
          }, 100)
        }
      }
    }
  }

  function disconnectBluetooth() {
    if (bluetoothDevice?.gatt?.connected) {
      bluetoothDevice.gatt.disconnect()
    }
    setBluetoothConnected(false)
    setBluetoothDevice(null)
    characteristicRef.current = null
    scanBufferRef.current = ''
    setNotice('Bluetooth scanner disconnected')
  }

  async function lookup(event: FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setLinen(null)
    try {
      const response = await dataApi.get<Linen>(`/linens/by-code/${encodeURIComponent(trimmed)}`)
      setLinen(response.data)
    } catch (caught) {
      const errorMsg = errorMessage(caught)
      setError(errorMsg)
      // Log error for debugging
      console.error('Scan lookup failed:', errorMsg)
    } finally {
      setBusy(false)
    }
  }

  async function apply(action: string) {
    if (!linen || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await dataApi.post<{ status?: string }>(`/linens/${linen.id}/scan`, {
        action,
      })
      const nextStatus = response.data?.status ?? action
      setLinen({ ...linen, status: nextStatus })
      setNotice(`Applied "${action}" to ${linen.linen_id}.`)
      setCode('')
    } catch (caught) {
      const errorMsg = errorMessage(caught)
      setError(errorMsg)
      console.error('Scan action failed:', errorMsg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader 
        title="Scan" 
        subtitle="Look up a tag, then move the piece on"
        action={
          bluetoothSupported && (
            <Button
              variant={bluetoothConnected ? "danger" : "secondary"}
              size="sm"
              onClick={bluetoothConnected ? disconnectBluetooth : connectBluetooth}
              disabled={busy}
            >
              {bluetoothConnected ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Disconnect Bluetooth
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  Connect Bluetooth Scanner
                </>
              )}
            </Button>
          )
        }
      />

      {bluetoothSupported && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${bluetoothConnected ? 'bg-green-500' : 'bg-slate-400'}`} />
            <span className="text-sm text-blue-900">
              {bluetoothConnected 
                ? `Connected to ${bluetoothDevice?.name || 'Bluetooth Scanner'} - scans will auto-submit`
                : 'Bluetooth scanner available but not connected. Click the button above to connect.'
              }
            </span>
          </div>
          {bluetoothError && (
            <p className="mt-2 text-xs text-red-700">{bluetoothError}</p>
          )}
        </div>
      )}

      <form onSubmit={lookup} className="mb-4 flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={bluetoothConnected ? "Bluetooth scanner active - or type manually" : "Scan or type a tag, e.g. LL-000123"}
          autoFocus={!bluetoothConnected}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Find'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}

      {linen ? (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-slate-500">{linen.linen_id}</p>
              <h2 className="mt-1 text-lg font-semibold">
                {linen.item_type} · {linen.category}
              </h2>
              <p className="text-sm text-slate-600">{linen.client_name}</p>
            </div>
            <div className="text-right">
              <StatusChip status={linen.status} />
              <p className="mt-2 text-xs text-slate-500">
                Condition {linen.condition} · {linen.wash_count ?? 0} washes
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map((entry) => (
              <button
                key={entry.action}
                onClick={() => void apply(entry.action)}
                disabled={busy}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {entry.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            &quot;Retire&quot; is intentionally absent: retiring a piece is irreversible and stays a
            supervisor action in the management app.
          </p>
        </Panel>
      ) : null}
    </>
  )
}
