using System.Text.Json.Serialization;

namespace NitroGroups.Shared.Contracts.Bookings.Requests
{
    /// <summary>
    /// Cuerpo de <c>PUT api/groups/{groupId}/gigs/{id}/details</c>. Es una actualización parcial:
    /// solo se tocan las propiedades que vienen en el JSON, y enviar <c>null</c> limpia el campo.
    /// Las propiedades <c>Has*</c> distinguen "no enviada" de "enviada como null".
    /// </summary>
    public class UpdateGigDetailsBody
    {
        private string? _setlist;
        private TimeOnly? _callTime;
        private decimal? _depositAmount;
        private bool? _depositReceived;
        private bool? _balanceReceived;
        private DateOnly? _depositDueDate;
        private DateOnly? _balanceDueDate;

        /// <summary>Lista de canciones en texto libre (máximo 4000 caracteres).</summary>
        public string? Setlist
        {
            get => _setlist;
            set { _setlist = value; HasSetlist = true; }
        }

        /// <summary>Hora de llamado ("HH:mm" o "HH:mm:ss").</summary>
        public TimeOnly? CallTime
        {
            get => _callTime;
            set { _callTime = value; HasCallTime = true; }
        }

        /// <summary>Monto del anticipo; no puede ser negativo.</summary>
        public decimal? DepositAmount
        {
            get => _depositAmount;
            set { _depositAmount = value; HasDepositAmount = true; }
        }

        /// <summary><c>true</c> fija la fecha de recepción del anticipo en este momento; <c>false</c> la limpia.</summary>
        public bool? DepositReceived
        {
            get => _depositReceived;
            set { _depositReceived = value; HasDepositReceived = true; }
        }

        /// <summary>Igual que <c>DepositReceived</c>, para el saldo: <c>true</c> fija la fecha en este momento; <c>false</c> la limpia.</summary>
        public bool? BalanceReceived
        {
            get => _balanceReceived;
            set { _balanceReceived = value; HasBalanceReceived = true; }
        }

        /// <summary>
        /// Fecha límite del anticipo (S24), como <c>YYYY-MM-DD</c>. Es un día del calendario, no un
        /// instante. Enviarla como <c>null</c> la limpia; omitirla no la toca. Una fecha que ya pasó se
        /// acepta igual: la app registra el plazo, no lo cumple ni lo valida.
        /// </summary>
        public DateOnly? DepositDueDate
        {
            get => _depositDueDate;
            set { _depositDueDate = value; HasDepositDueDate = true; }
        }

        /// <summary>Igual que <c>DepositDueDate</c>, para el saldo.</summary>
        public DateOnly? BalanceDueDate
        {
            get => _balanceDueDate;
            set { _balanceDueDate = value; HasBalanceDueDate = true; }
        }

        [JsonIgnore] public bool HasSetlist { get; private set; }
        [JsonIgnore] public bool HasCallTime { get; private set; }
        [JsonIgnore] public bool HasDepositAmount { get; private set; }
        [JsonIgnore] public bool HasDepositReceived { get; private set; }
        [JsonIgnore] public bool HasBalanceReceived { get; private set; }
        [JsonIgnore] public bool HasDepositDueDate { get; private set; }
        [JsonIgnore] public bool HasBalanceDueDate { get; private set; }
    }
}
