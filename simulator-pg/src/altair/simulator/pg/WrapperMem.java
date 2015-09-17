package altair.simulator.pg;

import altair.simulator.core.value.IValueProperties;
import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMem.MemTypeEnum;
import altair.simulator.infrastructure.reg.real.IExternalReg;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterPermissionEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTransferMethodEnum;
import altair.util.java6.identifier.IIdentifier;

public class WrapperMem {

	IMem mem;

	public WrapperMem(IMem mem) {
		this.mem = mem;
	}

	public IIdentifier getIdentifier() {
		return mem.getIdentifier();
	}

	public MemTypeEnum getMemType() {
		return mem.getMemType();
	}

	public boolean lw(int address, IReg dst) {
		return mem.lw(address, dst);
	}

	public int getSize() {
		return mem.getSize();
	}

	public boolean isComplex() {
		return mem.isComplex();
	}

	public boolean sw(int address, IReg src) {
		return mem.sw(address, src);
	}

	public int getAddr() {
		return mem.getAddr();
	}

	public boolean isInitialized() {
		return mem.isInitialized();
	}

	public RegisterPermissionEnum getPermission() {
		return mem.getPermission();
	}

	public boolean existAddress(int address) {
		return mem.existAddress(address);
	}

	public void setPermission(RegisterPermissionEnum newPermission) {
		mem.setPermission(newPermission);
	}

	public boolean hasReadPermission(int address) {
		return mem.hasReadPermission(address);
	}

	public RegisterTransferMethodEnum getTransferMethod() {
		return mem.getTransferMethod();
	}

	public IValueProperties getValueProperties() {
		return mem.getValueProperties();
	}

	public boolean hasWritePermission(int address) {
		return mem.hasWritePermission(address);
	}

	public IExternalReg get(int address) {
		return mem.get(address);
	}
	
	
}
