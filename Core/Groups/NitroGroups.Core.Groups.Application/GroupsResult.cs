namespace NitroGroups.Core.Groups.Application;

/// <summary>
/// Tipo de error de un caso de uso de Groups; los endpoints lo traducen a un código HTTP.
/// Existe porque <see cref="Shared.Contracts.Result{T}"/> solo distingue éxito de fallo y estas
/// reglas necesitan 400 / 403 / 404 / 409 bien diferenciados.
/// </summary>
public enum GroupsErrorKind
{
    None = 0,

    /// <summary>400: datos inválidos.</summary>
    Validation,

    /// <summary>401: el usuario no está registrado o no está sincronizado.</summary>
    Unauthorized,

    /// <summary>403: participa, pero su papel no permite esta acción.</summary>
    Forbidden,

    /// <summary>404: no existe o el usuario no participa (no se revela su existencia).</summary>
    NotFound,

    /// <summary>409: el estado actual no permite la acción.</summary>
    Conflict
}

/// <summary>Resultado de los casos de uso de Groups, con el tipo de error.</summary>
public sealed class GroupsResult<T>
{
    private GroupsResult(T? value, GroupsErrorKind errorKind, string error)
    {
        Value = value;
        ErrorKind = errorKind;
        Error = error;
    }

    public T? Value { get; }
    public GroupsErrorKind ErrorKind { get; }
    public string Error { get; }
    public bool IsSuccess => ErrorKind == GroupsErrorKind.None;
    public bool IsFailure => !IsSuccess;

    public static GroupsResult<T> Success(T value) => new(value, GroupsErrorKind.None, string.Empty);

    public static GroupsResult<T> Failure(GroupsErrorKind kind, string error) => new(default, kind, error);

    public static GroupsResult<T> NotFound(string error) => Failure(GroupsErrorKind.NotFound, error);

    public static GroupsResult<T> Conflict(string error) => Failure(GroupsErrorKind.Conflict, error);

    public static GroupsResult<T> Forbidden(string error) => Failure(GroupsErrorKind.Forbidden, error);

    public static GroupsResult<T> Validation(string error) => Failure(GroupsErrorKind.Validation, error);
}
