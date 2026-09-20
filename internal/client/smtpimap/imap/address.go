package imap

import (
	"fmt"

	"github.com/emersion/go-imap/v2"
	"github.com/warmbly/warmbly/internal/pkg/mailhdr"
)

func GetAddressName(address imap.Address) string {
	addr := address.Addr()
	name := mailhdr.DecodeWords(address.Name)
	if name == "" {
		return addr
	}
	return fmt.Sprintf("%s <%s>", name, addr)
}

func GetAddressNames(addresses []imap.Address) []string {
	var addrs []string = make([]string, len(addresses))
	for i, addr := range addresses {
		addrs[i] = GetAddressName(addr)
	}
	return addrs
}
