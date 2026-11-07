/** Fila de `GET api/groups/{groupId}/team/public` (S14). Nunca lleva correo. */
export interface PublicGroupTeamMember {
    /** Id del usuario, el mismo de `/musicians/{userId}`. */
    userId: number;
    fullName: string;
    /** Nombre del rol según el backend (Owner/Manager/Member) o su número: se normaliza al leer. */
    role: unknown;
    /** Instrumentos que toca; null cuando no los cargó o cuando cerró su perfil. */
    instruments?: string | null;
    /** Ciudad del músico; null cuando no la cargó o cuando cerró su perfil. */
    city?: string | null;
}
