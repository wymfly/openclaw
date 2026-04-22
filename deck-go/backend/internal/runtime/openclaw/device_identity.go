package openclaw

func CurrentDeviceID() (string, error) {
	return transportBinding.CurrentDeviceID()
}
