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
import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMem.MemTypeEnum;
import altair.simulator.infrastructure.mem.IMemView;
import altair.simulator.infrastructure.mem.IMemView.MemOffset;
import altair.simulator.infrastructure.mem.Mem;
import altair.simulator.infrastructure.mem.MemView;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterPermissionEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTransferMethodEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTypeEnum;
import altair.simulator.iss.asip.Asip;
import altair.simulator.iss.asip.IAsipWrapper;
import altair.simulator.iss.asip.lsiu.instructionmemory.IInstructionMemory;
import altair.simulator.iss.asip.routineparser.GlobalDefines;
import altair.simulator.iss.asip.routineparser.InstructionMemoryFactory;
import altair.simulator.utils.logging.bus.EventBus;
import altair.simulator.utils.logging.monitor.FurandMonitor;
import altair.simulator.utils.logging.monitor.StatisticsMonitor;
import altair.simulator.utils.logging.publisher.GeneralLogEventPublisher;
import altair.util.Files;
import altair.util.java6.identifier.IIdentifier;
import altair.util.java6.identifier.StringIdentifier;

import com.google.common.base.Joiner;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;

public class SimpleRoutineExecution {

	@Before
	public void pre() {
		EventBus.INSTANCE.addListener(FurandMonitor.INSTANCE);
		EventBus.INSTANCE.addListener(StatisticsMonitor.INSTANCE);
	}

	@Test
	public void ddd() throws IOException {
		File skeletonFile = Files.getSystemResourceAsFile("skeletons/minimal_asip.xml");
		File memFile = Files.getSystemResourceAsFile("mems_griffin_2.xml");
		File bootCodeFile = Files.getSystemResourceAsFile("boot-code.acml");
		File routineFile = Files.getSystemResourceAsFile("bbb.acml");
		File machineFile = Files.getSystemResourceAsFile("skeletons/machine_griffin3.xml");
		File addressSpaceFile = Files.getSystemResourceAsFile("mem/address_space_griffin.xml");

		IAsip skeleton = AsipSkeletonXml.create(skeletonFile);
		IMemSourceSkeleton memSkeletonXml = MemSkeletonXml.create(memFile);
		IMachineSkeleton machineDef = MachineSkeletonXml.create(machineFile, memSkeletonXml);
		IAddressSpaceSkeleton addrSpDef = AddressSpaceSkeletonXml.create(addressSpaceFile);

		IAsipWrapper testAsip = new Asip("DDD", skeleton, machineDef, buildAsipMemView(machineDef, addrSpDef,
				StringIdentifier.identifier("DDD")));

		GlobalDefines globalDefines = buildGlobalDefines();

		List<String> fnames = Lists.newArrayList("boot_code", "my_routine");
		IInstructionMemory insMem = InstructionMemoryFactory.INSTANCE.buildInstructionMemory(testAsip, globalDefines,
				skeleton, fnames, Files.filesToStreams(bootCodeFile, routineFile));
		
		testAsip.getLsiu().setInstructionMemory(insMem);

		// config external pc

		testAsip.getAsipDispatcher().startAsipRun();
		while (testAsip.getAsipDispatcher().executeInstruction()) {
			IReg pc = testAsip.getAsipPcu().findReg(StringIdentifier.identifier("PC"));
			System.out.println(pc.getUnsignedValue());
		}
		;
		System.out.println(StatisticsMonitor.INSTANCE.getFatalCount());
		System.out.println(FurandMonitor.INSTANCE.getMonitorData());
	}

	private GlobalDefines buildGlobalDefines() {
		Map<String, Integer> globalDefines = Maps.newHashMap();
		globalDefines.put("SFBC_LLROUT_MASK", 0xFEFF);
		globalDefines.put("SFBC_ALU0_MASK", 0xFBFF);
		globalDefines.put("SFBC_SNIFFER_ADDRESS", 0xFFFF);
		globalDefines.put("SFBC_N_BUILD_IN_COUPLES", 6);
		globalDefines.put("SFBC_Y_INC", 100);
		globalDefines.put("SFBC_Y11_BASE", 101);
		globalDefines.put("SFBC_Y12_BASE", 102);
		globalDefines.put("SFBC_Y21_BASE", 103);
		globalDefines.put("SFBC_Y22_BASE", 104);
		globalDefines.put("SFBC_H11_BASE", 105);
		globalDefines.put("SFBC_H12_BASE", 106);
		globalDefines.put("SFBC_H21_BASE", 107);
		globalDefines.put("SFBC_H22_BASE", 108);
		globalDefines.put("SFBC_GAIN0_PTR", 109);
		globalDefines.put("SFBC_GAIN1_PTR", 110);
		globalDefines.put("SFBC_TRASH_LLRS", 111);
		globalDefines.put("SFBC_HARD_VALUES_BASE", 112);
		globalDefines.put("SFBC_HARD_VALUES_OUTPUT_INC", 113);
		globalDefines.put("SFBC_N_DATA_COUPLES_PER_SCH", 114);
		globalDefines.put("SFBC_LLROUT_BOOST", 115);
		globalDefines.put("SFBC_DIV_CONST_NORM", 116);
		globalDefines.put("SFBC_CONSTELLATION", 117);
		globalDefines.put("SFBC_NORM_FACTOR_SHIFT", 118);
		globalDefines.put("SFBC_DIV_SIGMA_BASE", 119);
		globalDefines.put("SFBC_N_SCH", 120);
		globalDefines.put("SFBC_CONST_NORM2", 121);
		globalDefines.put("SFBC_CMAC0_SHSET", 122);
		globalDefines.put("SFBC_CMAC1_SHSET", 123);
		globalDefines.put("SFBC_CMAC2_SHSET", 124);
		return new GlobalDefines(globalDefines);
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
