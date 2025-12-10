import {apiUrl} from './base'

export interface NpxPackage {
    id?: string
    name: string
    description: string
    version: string
    usage: string
    npmLink: string
    fullName: string
    createdAt?: string
    updatedAt?: string
}

export const fetchNpxPackages = async (scope?: string): Promise<NpxPackage[]> => {
    const params = new URLSearchParams()
    if (scope) {
        params.set('scope', scope)
    }

    const res = await fetch(apiUrl(`/api/mcp/npx?${params.toString()}`), {
        method: 'GET',
        headers: {'Content-Type': 'application/json'}
    })

    if (!res.ok) {
        throw new Error(`搜索 NPX 包失败: ${res.status} ${res.statusText}`)
    }

    return res.json()
}

export const createNpxPackage = async (pkg: Partial<NpxPackage>): Promise<NpxPackage> => {
    const res = await fetch(apiUrl('/api/mcp/npx'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pkg)
    })

    if (!res.ok) {
        throw new Error(`创建 NPX 包记录失败: ${res.status} ${res.statusText}`)
    }

    return res.json()
}

export const updateNpxPackage = async (
    id: string,
    pkg: Partial<NpxPackage>
): Promise<NpxPackage> => {
    const res = await fetch(apiUrl(`/api/mcp/npx/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pkg)
    })

    if (!res.ok) {
        throw new Error(`更新 NPX 包记录失败: ${res.status} ${res.statusText}`)
    }

    return res.json()
}

export const deleteNpxPackage = async (id: string): Promise<void> => {
    const res = await fetch(apiUrl(`/api/mcp/npx/${encodeURIComponent(id)}`), {
        method: 'DELETE'
    })

    if (!res.ok) {
        throw new Error(`删除 NPX 包记录失败: ${res.status} ${res.statusText}`)
    }
}

