'use client'

type DayData = { day: string; sessions: number; unique_users: number }

export default function StatsConnectionsChart({ data }: { data: DayData[] }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nicio conectare încă.</p>
  }

  const maxVal = Math.max(...data.map((d) => d.sessions), 1)

  return (
    <div>
      <div className="flex items-end gap-1.5 h-48" style={{ minHeight: '12rem' }}>
        {data.map((d) => {
          const sessionsHeight = (d.sessions / maxVal) * 100
          const usersHeight = (d.unique_users / maxVal) * 100
          const date = new Date(d.day)
          const label = `${date.getDate()}/${date.getMonth() + 1}`

          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 whitespace-nowrap rounded px-2 py-1 text-xs"
                style={{ background: '#0a1628', color: '#fff' }}>
                {d.sessions} sesiuni · {d.unique_users} unici
              </div>

              {/* Bars */}
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '11rem' }}>
                <div className="rounded-t transition-all" style={{
                  width: '45%',
                  height: `${sessionsHeight}%`,
                  background: '#FF6B35',
                  minHeight: d.sessions > 0 ? '3px' : '0',
                }} title={`${d.sessions} sesiuni`}></div>
                <div className="rounded-t transition-all" style={{
                  width: '45%',
                  height: `${usersHeight}%`,
                  background: '#00A8B5',
                  minHeight: d.unique_users > 0 ? '3px' : '0',
                }} title={`${d.unique_users} utilizatori unici`}></div>
              </div>

              {/* Label */}
              <span className="text-[9px] text-gray-400">{label}</span>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: '#FF6B35' }}></span>
          <span className="text-gray-500">Total sesiuni</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: '#00A8B5' }}></span>
          <span className="text-gray-500">Utilizatori unici</span>
        </div>
      </div>
    </div>
  )
}
