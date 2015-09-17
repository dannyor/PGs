package altair.simulator.pg;

import java.io.File;
import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.junit.Before;
import org.junit.Test;

import altair.o2p.database.skeleton.asip.AsipSkeletonXml;
import altair.o2p.database.skeleton.asip.IAsip;
import altair.o2p.database.skeleton.machine.IMachineSkeleton;
import altair.o2p.database.skeleton.machine.MachineSkeletonXml;
import altair.o2p.database.skeleton.machine.addrspace.AddressSpaceSkeletonXml;
import altair.o2p.database.skeleton.machine.addrspace.IAddressSpaceSkeleton;
import altair.o2p.database.skeleton.machine.addrspace.IMipsAddr;
import altair.o2p.database.skeleton.machine.mem.IMemSkeleton;
import altair.o2p.database.skeleton.machine.mem.IMemSourceSkeleton;
import altair.o2p.database.skeleton.machine.mem.IMemViewSkeleton;
import altair.o2p.database.skeleton.machine.mem.IMemViewSkeletonProperty;
import altair.o2p.database.skeleton.machine.mem.MemSkeletonXml;
import altair.simulator.infrastructure.machine.IMachine;
import altair.simulator.infrastructure.machine.Machine;
import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMem.MemTypeEnum;
import altair.simulator.infrastructure.mem.IMemView;
import altair.simulator.infrastructure.mem.IMemView.MemOffset;
import altair.simulator.infrastructure.mem.Mem;
import altair.simulator.infrastructure.mem.MemView;
import altair.simulator.infrastructure.reg.real.IExternalReg;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterPermissionEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTransferMethodEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTypeEnum;
import altair.simulator.iss.asip.Asip;
import altair.simulator.iss.asip.IAsipWrapper;
import altair.simulator.iss.asip.lsiu.instructionmemory.IInstructionMemory;
import altair.simulator.iss.asip.routineparser.GlobalDefines;
import altair.simulator.iss.asip.routineparser.InstructionMemoryFactory;
import altair.simulator.iss.fu.IFu;
import altair.simulator.utils.logging.bus.EventBus;
import altair.simulator.utils.logging.monitor.FurandMonitor;
import altair.simulator.utils.logging.monitor.StatisticsMonitor;
import altair.simulator.utils.logging.publisher.GeneralLogEventPublisher;
import altair.util.Files;
import altair.util.java6.identifier.IIdentifier;
import altair.util.java6.identifier.StringIdentifier;
import altair.util.resource.Resources;

import com.google.common.base.Joiner;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;

public class SimpleRoutineExecution2 {

	File skeletonFile;
	File memFile;
	File bootCodeFile;
	File routineFile;
	File machineFile;
	File addressSpaceFile;

	IAsip skeleton;
	IMemSourceSkeleton memSkeletonXml;
	IMachineSkeleton machineDef;
	IAddressSpaceSkeleton addrSpDef;
	IAsipWrapper asip;
	private IInstructionMemory instructionMem;
	private IMachine machine;

	@Before
	public void prepare() {
		EventBus.INSTANCE.addListener(FurandMonitor.INSTANCE);
		EventBus.INSTANCE.addListener(StatisticsMonitor.INSTANCE);
		loadResources();
		buildAsip();
		buildGlobalDefines();
		buildInstructionMemory(globalDefines);
	}

	@Test
	public void runAsip() throws IOException {

		machine.getAddressSpace().setCregValueDirect(0+globalDefines.getDefineValue("BBB_NUM1"), 4, 0);
		machine.getAddressSpace().setCregValueDirect(0+globalDefines.getDefineValue("BBB_NUM2"), 1, 0);
//		machine.getAddressSpace().setCregValueDirect(0+globalDefines.getDefineValue("BBB_OUT"), 0xFFFA, 0);
		
		IMem mem = machine.getAddressSpace().getMem(0+globalDefines.getDefineValue("BBB_NUM1"));
		
		
		long regValueDirect1 = machine.getAddressSpace().getRegValueDirect(0+globalDefines.getDefineValue("BBB_NUM1"));
		long regValueDirect2 = machine.getAddressSpace().getRegValueDirect(0+globalDefines.getDefineValue("BBB_NUM2"));
		
		asip.getAsipDispatcher().startAsipRun();
		while (asip.getAsipDispatcher().executeInstruction()) {
			IReg pc = asip.getAsipPcu().findReg(StringIdentifier.identifier("PC"));
			System.out.println(pc.getUnsignedValue());
		}

		System.out.println(">> "+instructionMem.getRoutineIndex("bbb"));
		IReg externalPc = asip.getAsipPcu().findReg(StringIdentifier.identifier("EXTERNAL_PC"));
		externalPc.setUnsignedValue(instructionMem.getRoutineIndex("bbb"));
		asip.getAsipDispatcher().startAsipRun();
		while (asip.getAsipDispatcher().executeInstruction()) {
			IReg pc = asip.getAsipPcu().findReg(StringIdentifier.identifier("PC"));
			System.out.println(pc.getUnsignedValue());
		}

		IFu imm0 = asip.getFu(StringIdentifier.identifier("IMM0"));
		System.out.println(imm0.findReg(StringIdentifier.identifier("Q")));
		
		System.out.println(StatisticsMonitor.INSTANCE.getFatalCount());
		System.out.println(FurandMonitor.INSTANCE.getMonitorData());
	}

	private void buildInstructionMemory(GlobalDefines globalDefines) {
		instructionMem = InstructionMemoryFactory.INSTANCE.buildInstructionMemory(asip, globalDefines, skeleton,
				Resources.create(bootCodeFile, routineFile));

		asip.getLsiu().setInstructionMemory(instructionMem);
	}

	private void buildAsip() {
		skeleton = AsipSkeletonXml.create(skeletonFile);
		memSkeletonXml = MemSkeletonXml.create(memFile);
		machineDef = MachineSkeletonXml.create(machineFile, memSkeletonXml);
		addrSpDef = AddressSpaceSkeletonXml.create(addressSpaceFile);
		machine = new Machine(machineDef, addrSpDef, memSkeletonXml, Collections.singletonList(skeleton));

		asip = new Asip("DDD", skeleton, machineDef, buildAsipMemView(machineDef, addrSpDef,
				StringIdentifier.identifier("DDD")));
		
	}

	private void loadResources() {
		skeletonFile = Files.getSystemResourceAsFile("skeletons/minimal_asip.xml");
		memFile = Files.getSystemResourceAsFile("mems_griffin_2.xml");
		bootCodeFile = Files.getSystemResourceAsFile("boot-code.acml");
		routineFile = Files.getSystemResourceAsFile("routine1.acml");
		machineFile = Files.getSystemResourceAsFile("skeletons/machine_griffin3.xml");
		addressSpaceFile = Files.getSystemResourceAsFile("mem/address_space_griffin.xml");
	}

	GlobalDefines globalDefines;
	
	private void buildGlobalDefines() {
		Map<String, Integer> globalDefinesMap = Maps.newHashMap();
		globalDefinesMap.put("BBB_NUM1", 0xF0);
		globalDefinesMap.put("BBB_NUM2", 0xFF);
		globalDefinesMap.put("BBB_OUT", 0xFFFF);
		globalDefines =  new GlobalDefines(globalDefinesMap);
	}

	private IMemView buildAsipMemView(IMachineSkeleton machineDefinition, IAddressSpaceSkeleton addressSpaceDefinition,
			IIdentifier asipID) {
		// build asip mem view based on definitions
		IMemView asipMemView;
		Collection<IMemViewSkeleton> asipMemViews = machineDefinition.getEngineMemViews(asipID);
		if (asipMemViews.size() != 1) {
			GeneralLogEventPublisher.FATAL.publishEvent(Joiner.on("").join("Asip ", asipID,
					" not mapped to a single memview, instead mapped to ", asipMemViews.size(), " memviews\n"));
			asipMemView = MemView.zeroMemView;
		} else {
			IMemViewSkeleton memViewDef = asipMemViews.iterator().next();
			List<MemOffset> memsOffsets = Lists.newArrayList();
			for (IMemViewSkeletonProperty memViewDefProp : memViewDef.getMemViewProperties()) {
				// build mem view memory and insert it into the asip mem view
				IMemSkeleton memSkel = memViewDefProp.getMemSkeleton();
				IMipsAddr memMipsAddr = addressSpaceDefinition.getMipsAddress(memSkel.getIdentifier());
				if (memMipsAddr == IMipsAddr.zeroMipsAddr) {
					GeneralLogEventPublisher.FATAL.publishEvent(Joiner.on("").join("Asip ", asipID,
							" has an associated memory ", memSkel.getIdentifier(),
							" which does not have a MIPS address\n"));
				} else {
					MemTypeEnum memType = MemTypeEnum.values()[memSkel.getMemProperties().iterator().next()
							.getMemType().ordinal()];
					IMem newMem = new Mem(memSkel.getIdentifier().toString(), memMipsAddr.getBaseAddress(),
							memSkel.getSize(), memSkel.getMemCellWidth(), memType, RegisterTypeEnum.values()[memSkel
									.getMemCellType().ordinal()], RegisterTransferMethodEnum.values()[memSkel
									.getMemCellTransferMethod().ordinal()], RegisterPermissionEnum.values()[memSkel
									.getMemCellPermissionType().ordinal()]);
					memsOffsets.add(new MemOffset(newMem, memViewDefProp.getVirtualAddressOffset()));
				}
			}
			asipMemView = new MemView(memViewDef.getIdentifier().toString(), memsOffsets);
		}
		return asipMemView;
	}

}
