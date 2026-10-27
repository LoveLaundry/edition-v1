import { useState, type FormEvent, useEffect, useRef } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { PageHeader, Panel, StatusChip, Button } from '../ui/kit'

interface ScanResult {
  linen_id: string
  from_status: string
  to_status: string
}

interface BulkScanResponse {
  processed: ScanResult[]
  errors: string[]
  total_processed: number
  total_errors: number
}

/** The statuses a bulk scan may move pieces to, exactly as the API defines them. */
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

export function BulkScanPage() {
  const [codes, setCodes] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults] = useState<BulkScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
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
      // Request Bluetooth device
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['00001812-0000-1000-8000-00805f9b34fb'] },
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
        ],
        optionalServices: ['00001812-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb'],
        acceptAllDevices: true,
      })

      setBluetoothDevice(device)
      
      const server = await device.gatt?.connect()
      if (!server) throw new Error('Failed to connect to GATT server')

      const services = await server.getServices()
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics()
          
          for (const characteristic of characteristics) {
            try {
              await characteristic.startNotifications()
              characteristic.addEventListener('characteristicvaluechanged', handleBluetoothData)
              characteristicRef.current = characteristic
              setBluetoothConnected(true)
              setNotice(`Connected to ${device.name || 'Bluetooth Scanner'} - scans will be added to the list`)
              return
            } catch (e) {
              continue
            }
          }
        } catch (e) {
          continue
        }
      }
      
      throw new Error('Could not find suitable characteristic for data reception')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Bluetooth device'
      setBluetoothError(errorMessage)
      setBluetoothConnected(false)
    }
  }

  function handleBluetoothData(event: Event) {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    
    if (value) {
      const decoder = new TextDecoder()
      const data = decoder.decode(value)
      
      scanBufferRef.current += data
      
      if (data.includes('\n') || data.includes('\r') || scanBufferRef.current.length >= 10) {
        const completeCode = scanBufferRef.current.trim().replace(/[\n\r]/g, '')
        scanBufferRef.current = ''
        
        if (completeCode) {
          // Add to the codes list
          setCodes(prev => {
            const trimmed = prev.trim()
            return trimmed ? `${trimmed}\n${completeCode}` : completeCode
          })
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

  const [notice, setNotice] = useState<string | null>(null)

  async function processBulkScan(event: FormEvent) {
    event.preventDefault()
    const trimmedCodes = codes.trim()
    if (!trimmedCodes || !selectedAction || busy) return

    // Parse codes - one per line or comma-separated
    const codeList = trimmedCodes
      .split(/[\n,]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)

    if (codeList.length === 0) {
      setError('Please enter at least one linen code')
      return
    }

    setBusy(true)
    setError(null)
    setResults(null)

    try {
      const response = await dataApi.post<BulkScanResponse>('/linens/bulk-scan', {
        linen_codes: codeList,
        action: selectedAction,
        location: location || null,
      })
      setResults(response.data)
      setCodes('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Bulk Scan"
        subtitle="Process multiple linens at once with the same action"
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
                ? `Connected to ${bluetoothDevice?.name || 'Bluetooth Scanner'} - scans will be automatically added to the list`
                : 'Bluetooth scanner available but not connected. Click the button above to connect.'
              }
            </span>
          </div>
          {bluetoothError && (
            <p className="mt-2 text-xs text-red-700">{bluetoothError}</p>
          )}
        </div>
      )}

      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}

      <Panel>
        <form onSubmit={processBulkScan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Linen Codes
            </label>
            <textarea
              value={codes}
              onChange={(event) => setCodes(event.target.value)}
              placeholder={bluetoothConnected 
                ? "Scanning via Bluetooth - codes will appear here automatically&#10;Or type manually below:"
                : "Enter linen codes, one per line or comma-separated&#10;LL-000123&#10;LL-000124&#10;LL-000125"
              }
              rows={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">
              {codes.trim().split(/[\n,]+/).filter(c => c.trim()).length} code{codes.trim().split(/[\n,]+/).filter(c => c.trim()).length !== 1 ? 's' : ''} entered
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Action
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACTIONS.map((entry) => (
                <button
                  key={entry.action}
                  type="button"
                  onClick={() => setSelectedAction(entry.action)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    selectedAction === entry.action
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Location (optional)
            </label>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g., Section A, Rack 3"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !selectedAction}
            className="w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? 'Processing...' : 'Process Bulk Scan'}
          </button>
        </form>
      </Panel>

      {error ? (
        <Panel className="mt-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {results ? (
        <Panel className="mt-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Scan Results</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Processed</p>
                <p className="font-medium text-emerald-700">{results.total_processed}</p>
              </div>
              <div>
                <p className="text-slate-500">Errors</p>
                <p className="font-medium text-red-700">{results.total_errors}</p>
              </div>
            </div>
          </div>

          {results.errors.length > 0 ? (
            <div className="mb-4 rounded-lg bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
              <ul className="text-sm text-red-600 list-disc list-inside">
                {results.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {results.processed.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Linen ID</th>
                    <th className="px-3 py-2 text-left font-semibold">From</th>
                    <th className="px-3 py-2 text-left font-semibold">To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.processed.map((result, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono text-xs">{result.linen_id}</td>
                      <td className="px-3 py-2">
                        <StatusChip status={result.from_status} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusChip status={result.to_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </>
  )
}
