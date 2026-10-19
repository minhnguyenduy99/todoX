package shared

type BaseDomainError interface {
	Get() (errorCode string, errorMessage string)
	Error() string
}
